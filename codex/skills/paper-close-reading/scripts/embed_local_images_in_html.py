#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import mimetypes
from pathlib import Path
import re


IMG_ATTR_RE = re.compile(r'(\b(?:src|srcset)=")([^"]+)(")', re.IGNORECASE)


def to_data_uri(image_path: Path) -> str:
    mime, _ = mimetypes.guess_type(image_path.name)
    mime = mime or "application/octet-stream"
    payload = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


def resolve_local_asset(html_path: Path, raw_src: str) -> Path | None:
    candidate = raw_src.strip()
    if not candidate:
        return None
    if candidate.startswith(("data:", "http://", "https://", "//", "/")):
        return None
    first = candidate.split(",")[0].strip().split()[0]
    asset_path = (html_path.parent / first).resolve()
    if not asset_path.exists() or not asset_path.is_file():
        return None
    return asset_path


def embed_images(html_path: Path) -> tuple[int, str]:
    html = html_path.read_text(encoding="utf-8")
    replaced = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal replaced
        image_path = resolve_local_asset(html_path, match.group(2))
        if image_path is None:
            return match.group(0)
        replaced += 1
        return f'{match.group(1)}{to_data_uri(image_path)}{match.group(3)}'

    updated = IMG_ATTR_RE.sub(replace, html)
    return replaced, updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Embed local image assets referenced from src or srcset into self-contained HTML files.")
    parser.add_argument("html", nargs="+", help="HTML file(s) to rewrite in place")
    args = parser.parse_args()

    for html_name in args.html:
        html_path = Path(html_name)
        replaced, updated = embed_images(html_path)
        html_path.write_text(updated, encoding="utf-8")
        print(f"{html_path}: embedded {replaced} image(s)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
