---
name: drive-digest
description: "Pull new files from a designated Google Drive inbox folder (under a secondary Google account) and digest them into ideas/daily/md/YYYY-MM-DD-digest.md. Supports Google Doc, PDF, HTML, Markdown, and image files. Use when the user says or implies: drive-digest, /drive-digest, Drive から取り込んで, Drive の youtube-digest を読んで, life-inbox を digest, ドライブの新着を確認して, または youtube-digest, paper-close-reading フォルダを処理してほしいとき."
metadata:
  short-description: "Ingest new Drive files from life-inbox into daily digest"
---

# Drive Digest

## Purpose

Read newly-added files from a Google Drive `life-inbox/` folder (on a secondary Google account distinct from the primary Gmail/Calendar account) and append concise Japanese digest entries to `ideas/daily/md/YYYY-MM-DD-digest.md`.

Designed for cases where the user manually drops content into Drive (e.g., Gemini web's "Save to Drive" for YouTube summaries, scanned PDFs, Markdown notes) and wants those entries reflected in the life repo's daily digest stream.

## Subfolder Convention

The `life-inbox/` folder on Drive has at minimum two subfolders by convention:

- `life-inbox/youtube-digest/` — YouTube video summaries (often saved from Gemini web)
- `life-inbox/paper-close-reading/` — paper-related notes / PDFs / figures destined for paper-close-reading workflow

Pass the subfolder name as the skill argument (or the user's natural-language equivalent) to scope the run. If no subfolder is given, the skill scans the whole `life-inbox/` recursively.

## Required Setup

### One-time, account-level (on Google Cloud Console)

1. Sign in to console.cloud.google.com with the primary Google account.
2. Open the existing project `codex-calendar-kta38` (shared with Gmail/Calendar setup).
3. Enable **Google Drive API** in this project: 「API とサービス」→「ライブラリ」→ "Google Drive API" → 有効化.

The existing OAuth client (`~/.config/life/google-calendar-credentials.json`) is reused. No new credentials file is needed.

### Per-PC, one-time (after Drive API is enabled)

The skill stores a Drive read-only OAuth token at `~/.config/life/drive-read-token.json`. To create it on a new PC:

```bash
conda activate life
python <skill-dir>/scripts/drive_reader.py --setup-only
```

This opens a browser for OAuth consent. Sign in with the same Google account that owns `life-inbox/`. The token is saved to `~/.config/life/drive-read-token.json`.

For headless PCs (e.g., remote SSH on `fenrir`), copy a working `drive-read-token.json` from another PC instead of running the dance over SSH.

## Repository Rules

Before writing output, read the current repository's `README.md` and `Rules.md` when available. For the `life` repo, the daily digest output lives at:

```text
ideas/daily/md/YYYY-MM-DD-digest.md
```

If the file already exists, append new sections. Do not overwrite existing entries.

## Storage Policy (life repo)

To keep state synced across PCs and preserve raw imported content, the skill uses **repo-tracked paths** for both seen-state and downloaded files:

```text
life/
├── .agent/state/drive-seen.json          # 既読 file ID (PC 横断で共有、git track)
└── ideas/
    ├── youtube-digest/
    │   └── YYYY-MM-DD/<filename>         # Drive からのダウンロード生ファイル (git track)
    └── daily/md/YYYY-MM-DD-digest.md     # Claude が生成する digest セクション (git track)
```

The script must be invoked **from the repo root** so relative paths resolve correctly.

## Workflow

1. **Authenticate and list**: from the life repo root, run the helper script to enumerate and download new files. Always pass `--seen` and `--download-dir` as repo-relative paths so all PCs share state.

   For `youtube-digest` subfolder:
   ```bash
   python <skill-dir>/scripts/drive_reader.py \
       --subfolder youtube-digest \
       --download-dir ideas/youtube-digest \
       --seen .agent/state/drive-seen.json \
       --max-files 20
   ```

   For `paper-close-reading` subfolder:
   ```bash
   python <skill-dir>/scripts/drive_reader.py \
       --subfolder paper-close-reading \
       --download-dir ideas/paper-close-reading \
       --seen .agent/state/drive-seen.json \
       --max-files 20
   ```

   The script outputs a JSON manifest on stdout describing newly-downloaded files. Already-processed files (recorded in `.agent/state/drive-seen.json`, shared across PCs via git) are skipped by default.

2. **Per-file processing**: for each entry in `new_files`, read the local copy via the standard Read tool and produce a digest section:

   - **Google Doc** (`mime_type` == `application/vnd.google-apps.document`): exported to Markdown — read directly and summarize.
   - **PDF** (`application/pdf`): convert with `pdftotext` from the `life` conda env, then summarize.
   - **HTML** (`text/html`): read and extract main content for summary.
   - **Markdown / plain text**: read and summarize as-is.
   - **Image** (`image/png`, `image/jpeg`): include the local path, original filename, and Drive link. Do not OCR unless the user explicitly asks.

3. **Output sections**: for the run's target day (`YYYY-MM-DD` = today by default), append one section per file to `ideas/daily/md/YYYY-MM-DD-digest.md`. Use the shape below.

4. **Render HTML**: if the daily digest already has rendering (via `url-digest` style), the existing renderer can be reused. Otherwise, leave HTML rendering for the next `url-digest`/`weekly-review` invocation; do not auto-render here.

5. **Auto-finalize**: after writing, run the shared finalize script (see below).

### Output Section Shape

For each ingested file, append:

```markdown
## Drive: <一行タイトル (元ファイル名 or 内容を要約した題)>

- 元ファイル: `<original filename>`
- 種別: Google Doc / PDF / HTML / Markdown / Image / その他
- 取得元: `life-inbox/<subfolder>/<...>`
- Drive リンク: <https://drive.google.com/...>
- 取得日: YYYY-MM-DD
- 更新日 (Drive): YYYY-MM-DD

### コアメッセージ

2-4 文で、このファイルから持ち帰るべき中心的な内容を日本語で書く。Google Doc や PDF の場合は本文を要約。画像のみの場合はファイル名・サイズ・コンテキストを記述し、内容判断は保留する。

### メモ

- 関連する研究・関心との接点 (1-3 点)
- 不確実性、未確認事項 (あれば)
- 後続アクション候補 (あれば)
```

## Style Rules

- Write digest entries in Japanese unless the user asks otherwise.
- Keep each entry short (10-25 lines). Long source files should be paraphrased, not pasted.
- For YouTube digest entries already summarized by Gemini web (the typical `life-inbox/youtube-digest/` content), prefer light editorial cleanup over re-summarization. The user's intent is to retain the Gemini summary structure.
- For paper-close-reading subfolder: do not run the full `paper-close-reading` skill workflow here. Just record metadata and a short message; the user can later invoke `paper-close-reading` against the local download for deeper processing.
- Distinguish facts from interpretation. Mark uncertainty when the source is unclear.

## Argument Handling

Accept these natural-language patterns from the user:

- "drive-digest" (no arg) → scan whole `life-inbox/`
- "drive-digest youtube-digest" or "youtube-digest を取り込んで" → scan `life-inbox/youtube-digest/`
- "drive-digest paper-close-reading" or "paper-close-reading を Drive から" → scan `life-inbox/paper-close-reading/`

Pass the resolved subfolder name to the script via `--subfolder`.

If the user explicitly asks to re-process everything, run with `--reset-seen` (warn first that this re-downloads all files).

## Validation

After processing:

1. Check `ideas/daily/md/YYYY-MM-DD-digest.md` exists and contains the new sections.
2. Report the number of files ingested, skipped, and any download errors from the script's JSON output.
3. List the local download directory so the user can find the cached originals.

## Auto-finalize

After producing the Markdown digest, run the shared finalize script. It is a no-op unless `AGENT_AUTO_COMMIT=1` is exported in the shell. On `fenrir` this is the default; on Air / mini-lab it is unset, so this call has no effect.

The finalize call must include **all three** path categories so they stay in sync across PCs:

1. The seen-state file (`.agent/state/drive-seen.json`)
2. The downloaded raw files in `ideas/<subfolder>/YYYY-MM-DD/...`
3. The daily digest Markdown that was appended to

Example for `youtube-digest`:

```bash
bash scripts/agent_auto_finalize.sh \
  -m "docs: 📝 drive-digest: youtube-digest YYYY-MM-DD" \
  .agent/state/drive-seen.json \
  ideas/youtube-digest/YYYY-MM-DD \
  ideas/daily/md/YYYY-MM-DD-digest.md
```

Pass the directory `ideas/youtube-digest/YYYY-MM-DD` (not individual files) so all newly-downloaded files in that date folder are committed together. The script commits with `-o` so other staged changes are not swept in.

Binary-only files (e.g., `.png`, `.jpg` with no text content) can bloat the repo if many accumulate; if that becomes a concern, add a `.gitignore` rule for those extensions under `ideas/youtube-digest/` later. For now, keep everything to preserve the raw content alongside its digest summary.
