#!/usr/bin/env python3
"""Read files from a designated Google Drive folder and prepare them for skill ingestion.

Authenticates against Drive (read-only), lists files in a target folder
(recursively), downloads or exports new ones to a local cache, and emits a
JSON manifest of newly-downloaded files for the skill to digest.

Designed to mirror the existing Gmail/Calendar OAuth pattern in
`life/scripts/`. Default credentials and token paths live under
`~/.config/life/`. The OAuth client is shared with Gmail/Calendar (Drive
API must be enabled in the same Google Cloud project).

Typical usage from the skill:

    python3 drive_reader.py \\
        --subfolder youtube-digest \\
        --download-dir ~/.cache/life/drive-digest

Use `--setup-only` for the first-time OAuth dance on a new PC.
"""

from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import sys
from pathlib import Path
from typing import Any

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DEFAULT_CREDENTIALS = Path("~/.config/life/google-calendar-credentials.json").expanduser()
DEFAULT_TOKEN = Path("~/.config/life/drive-read-token.json").expanduser()
DEFAULT_SEEN = Path("~/.config/life/drive-seen.json").expanduser()
DEFAULT_DOWNLOAD_DIR = Path("~/.cache/life/drive-digest").expanduser()
DEFAULT_INBOX = "life-inbox"

GOOGLE_DOC_MIME = "application/vnd.google-apps.document"
GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder"
GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet"
GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation"

# Each native Google file type maps to a list of (export_mime, extension) tuples
# tried in order. Earlier entries are richer; later entries are more reliable
# fallbacks when Google's export service returns 500 or otherwise fails.
EXPORT_MAP = {
    GOOGLE_DOC_MIME: [
        ("text/markdown", ".md"),
        ("text/plain", ".txt"),
        ("text/html", ".html"),
    ],
    GOOGLE_SHEET_MIME: [
        ("text/csv", ".csv"),
    ],
    GOOGLE_SLIDES_MIME: [
        ("application/pdf", ".pdf"),
    ],
}


def load_google_deps() -> tuple[Any, Any, Any, Any, Any]:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseDownload
    except ImportError as exc:
        raise SystemExit(
            "Google API dependencies missing. Install via:\n"
            "  conda env update -f environment.yml --prune"
        ) from exc
    return Request, Credentials, InstalledAppFlow, build, MediaIoBaseDownload


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    p.add_argument("--inbox", default=DEFAULT_INBOX, help=f"Top-level inbox folder name on Drive (default: {DEFAULT_INBOX})")
    p.add_argument("--subfolder", default="", help="Subfolder under inbox (e.g., youtube-digest, paper-close-reading). Empty = whole inbox.")
    p.add_argument("--credentials", default=str(DEFAULT_CREDENTIALS), help="OAuth client secrets JSON.")
    p.add_argument("--token", default=str(DEFAULT_TOKEN), help="OAuth token JSON.")
    p.add_argument("--seen", default=str(DEFAULT_SEEN), help="Seen-file IDs JSON path (per-PC).")
    p.add_argument("--download-dir", default=str(DEFAULT_DOWNLOAD_DIR), help="Local download root.")
    p.add_argument("--max-files", type=int, default=50, help="Safety cap on number of files processed per run.")
    p.add_argument("--include-seen", action="store_true", help="Also report files already in seen list (no re-download).")
    p.add_argument("--dry-run", action="store_true", help="List candidates without downloading or updating seen.")
    p.add_argument("--setup-only", action="store_true", help="Run OAuth dance and exit (use on first run per PC).")
    p.add_argument("--reset-seen", action="store_true", help="Wipe seen-file IDs and re-process everything.")
    return p.parse_args()


def load_credentials(args: argparse.Namespace) -> Any:
    Request, Credentials, InstalledAppFlow, _build, _download = load_google_deps()
    token_path = Path(args.token).expanduser()
    cred_path = Path(args.credentials).expanduser()

    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())

    if not creds or not creds.valid:
        if not cred_path.exists():
            raise SystemExit(
                f"OAuth client secrets JSON not found at {cred_path}.\n"
                "Drive API must be enabled in the corresponding Google Cloud project."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(cred_path), SCOPES)
        # Note: opens a browser. For headless PCs, copy a working token from another PC.
        creds = flow.run_local_server(port=0)

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(creds.to_json(), encoding="utf-8")
    try:
        token_path.chmod(0o600)
    except OSError:
        pass
    return creds


def find_folder_id(service: Any, parent_id: str | None, name: str) -> str | None:
    """Find a folder by name under parent_id. parent_id=None → search root drive."""
    safe_name = name.replace("'", "\\'")
    q_parts = [
        f"mimeType = '{GOOGLE_FOLDER_MIME}'",
        f"name = '{safe_name}'",
        "trashed = false",
    ]
    if parent_id:
        q_parts.append(f"'{parent_id}' in parents")
    q = " and ".join(q_parts)
    res = service.files().list(q=q, fields="files(id,name)", pageSize=10).execute()
    files = res.get("files", [])
    if not files:
        return None
    return files[0]["id"]


def list_files_recursive(service: Any, folder_id: str) -> list[dict[str, Any]]:
    """List all non-folder files recursively under folder_id."""
    out: list[dict[str, Any]] = []
    stack = [folder_id]
    while stack:
        current = stack.pop()
        page_token: str | None = None
        while True:
            res = service.files().list(
                q=f"'{current}' in parents and trashed = false",
                fields="nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size,parents)",
                pageSize=100,
                pageToken=page_token,
            ).execute()
            for f in res.get("files", []):
                if f["mimeType"] == GOOGLE_FOLDER_MIME:
                    stack.append(f["id"])
                else:
                    out.append(f)
            page_token = res.get("nextPageToken")
            if not page_token:
                break
    return out


def safe_filename(name: str) -> str:
    """Strip path separators and control characters."""
    return "".join(c for c in name if c.isprintable() and c not in "/\\").strip() or "untitled"


def _attempt_download(service: Any, file_id: str, request, dest_path: Path) -> None:
    _, _, _, _, MediaIoBaseDownload = load_google_deps()
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    dest_path.write_bytes(buf.getvalue())
    try:
        dest_path.chmod(0o600)
    except OSError:
        pass


def download_or_export(service: Any, file_meta: dict[str, Any], dest_dir: Path) -> Path:
    """Download a binary file or export a Google native file. Returns local path.

    For Google native files, tries each export format in EXPORT_MAP in order
    and falls back on the next one if Google returns a 5xx error (its export
    service is occasionally flaky for newer formats like text/markdown).
    """
    file_id = file_meta["id"]
    name = safe_filename(file_meta["name"])
    mime = file_meta["mimeType"]

    dest_dir.mkdir(parents=True, exist_ok=True)

    if mime in EXPORT_MAP:
        last_err: Exception | None = None
        for export_mime, ext in EXPORT_MAP[mime]:
            attempt_name = name if name.lower().endswith(ext.lower()) else f"{name}{ext}"
            local_path = dest_dir / attempt_name
            counter = 1
            while local_path.exists():
                stem = local_path.stem
                suf = local_path.suffix
                local_path = dest_dir / f"{stem}__{counter}{suf}"
                counter += 1
            try:
                request = service.files().export_media(fileId=file_id, mimeType=export_mime)
                _attempt_download(service, file_id, request, local_path)
                return local_path
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                if local_path.exists():
                    try:
                        local_path.unlink()
                    except OSError:
                        pass
                # Continue to next fallback format
        # All formats exhausted
        raise RuntimeError(
            f"all export formats failed for Google native file {file_id}; last error: {last_err}"
        )

    # Non-Google file: direct download
    local_path = dest_dir / name
    counter = 1
    while local_path.exists():
        stem = local_path.stem
        suf = local_path.suffix
        local_path = dest_dir / f"{stem}__{counter}{suf}"
        counter += 1
    request = service.files().get_media(fileId=file_id)
    _attempt_download(service, file_id, request, local_path)
    return local_path


def load_seen(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_seen(path: Path, seen: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(seen, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass


def main() -> int:
    args = parse_args()

    creds = load_credentials(args)
    if args.setup_only:
        print(f"OAuth setup complete. Token saved to {args.token}", file=sys.stderr)
        return 0

    _, _, _, build, _ = load_google_deps()
    service = build("drive", "v3", credentials=creds)

    inbox_id = find_folder_id(service, None, args.inbox)
    if not inbox_id:
        raise SystemExit(f"Inbox folder '{args.inbox}' not found in Drive root.")
    target_id = inbox_id
    target_label = args.inbox
    if args.subfolder:
        sub_id = find_folder_id(service, inbox_id, args.subfolder)
        if not sub_id:
            raise SystemExit(f"Subfolder '{args.subfolder}' not found under '{args.inbox}'.")
        target_id = sub_id
        target_label = f"{args.inbox}/{args.subfolder}"

    files = list_files_recursive(service, target_id)
    files.sort(key=lambda f: f.get("modifiedTime", ""), reverse=True)

    seen_path = Path(args.seen).expanduser()
    if args.reset_seen and seen_path.exists():
        seen_path.unlink()
    seen = load_seen(seen_path)

    today = dt.date.today().isoformat()
    # Caller is responsible for passing a subfolder-specific --download-dir
    # (e.g., `ideas/youtube-digest`), so we no longer nest by target label here.
    # We do still nest by date so accumulated downloads don't collide.
    download_root = Path(args.download_dir).expanduser() / today

    new_entries: list[dict[str, Any]] = []
    seen_entries: list[dict[str, Any]] = []

    for f in files:
        is_seen = f["id"] in seen
        bucket = seen_entries if is_seen else new_entries
        if not args.include_seen and is_seen:
            continue
        if not is_seen and len(new_entries) >= args.max_files:
            break

        entry = {
            "id": f["id"],
            "name": f["name"],
            "mime_type": f["mimeType"],
            "modified_time": f.get("modifiedTime"),
            "web_view_link": f.get("webViewLink"),
            "size": f.get("size"),
            "previously_seen": is_seen,
            "local_path": None,
        }

        if not is_seen and not args.dry_run:
            try:
                local = download_or_export(service, f, download_root)
                entry["local_path"] = str(local)
            except Exception as exc:  # noqa: BLE001
                entry["error"] = f"download_failed: {exc}"
        bucket.append(entry)

        if not is_seen and not args.dry_run and "error" not in entry:
            seen[f["id"]] = today

    if not args.dry_run:
        save_seen(seen_path, seen)

    output = {
        "target": target_label,
        "target_folder_id": target_id,
        "ran_at": dt.datetime.now().isoformat(timespec="seconds"),
        "download_root": str(download_root) if new_entries else None,
        "new_files": new_entries,
        "previously_seen_files": seen_entries if args.include_seen else [],
        "total_in_folder": len(files),
        "dry_run": args.dry_run,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
