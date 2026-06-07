---
name: find-notes
description: "Cross-cutting knowledge search across Drive desktop (local), Drive API, and Paperpile PDFs. Returns hits grouped by source with file path / URL / snippet. Use when the user says find-notes, /find-notes, メモを探して, あのメモどこ, 論文探して, papers about X, find that doc about X, Drive で X を探して, or wants to locate any note / doc / paper from across their knowledge base."
metadata:
  short-description: "Search across Drive (local) + Drive API + Paperpile PDFs"
---

# Find Notes

Cross-cutting knowledge search. Wraps `scripts/drive/find_notes.py` and formats the result for the user. The script searches multiple tiers:

- **Tier 1** (fast): filename match via `fd` over both Drive desktop mounts
- **Tier 2** (fast): full-text grep via `rg` over text-like files (.md / .txt / .csv / .json) in Drive
- **Tier 3** (fast): Drive API `fullText contains` search (UTokyo token only at present)
- **Tier 4** (slow, opt-in): Paperpile PDF full-text via `pdftotext` + match — Stream mode fetches each PDF on demand

This skill is intended for the `life` repo.

## Repository Rules

Before running:

1. Read `README.md` for directory policy if writing anywhere.
2. Read `Rules.md` for the safety rules (do not leak secrets / PII / unpublished data into hub Notes etc.).

This skill is read-only (no Markdown writes).

## When To Invoke

User-triggered. Typical cues:

- `find-notes` / `/find-notes`
- 「メモを探して」「あのメモどこ」「Drive で X を探して」
- 「論文探して」「X についての paper」「papers about X」
- 「学会メモ」「セミナーメモ」「読書メモ」と「キーワード」がセットの時

Do NOT auto-invoke on session start or Stop hook.

## Workflow

1. Run `date "+%Y-%m-%d %H:%M:%S %A %Z"` once (per `Rules.md`「日時認識」) — not because the date matters to search results, but to keep the per-turn convention.
2. Identify the search query from the user's prompt. If unclear, ask a 1-line clarifying question (do not search ambiguously).
3. Run:

   ```bash
   conda activate life
   python scripts/drive/find_notes.py "<query>" --limit 10
   ```

   - Add `--fulltext-pdf` if (a) the user explicitly asks for PDF body content, OR (b) the fast tiers returned almost no results AND the query looks paper-shaped (English term + "about / paper / 論文" cue).
   - Add `--year YYYY` with `--fulltext-pdf` to restrict the slow scan to one Paperpile year folder.
4. Take the script's output and present it to the user as a Markdown summary grouped by source. Trim verbose paths but keep them clickable / pastable.
5. Offer 1-2 follow-up actions:
   - `python scripts/drive/read_doc.py <URL>` to read a specific Doc / Sheet
   - `paper-close-reading` skill for a Paperpile PDF (after copying to `outputs/papers/tmp/`)

## Output Shape

Show the user a compact grouped list. Example:

```
**find-notes: "ferredoxin" — 18 hit(s) across 3 source(s)**

[paperpile]
- Frankenberg & Lagarias 2003 — Phycocyanobilin–Ferredoxin Oxidoreductase
- Hagiwara et al. 2006 — Crystal structure of PcyA
- Jagilinki et al. 2025 — Designing peptide fossils … ferredoxin fold
- (5 more)

[drive-api]
- Rockwell & Clark Lagarias 2017 — Ferredoxin-dependent bilin reductases
- Beale & Cornejo 1991 — Biosynthesis of phycobilins
- (3 more)

[drive-local-text]
- 2026 Wiki: "260518 Journal 波多野 … VIPP & ferredoxin discussion"

次のアクション:
- `python scripts/drive/read_doc.py <URL>` で Doc を開く
- `paper-close-reading` skill で PDF を精読
```

## Safety

- The script reads only; never writes durable artifacts.
- Do NOT echo any secrets or tokens; the script does not print them.
- For Paperpile PDF full-text search, warn the user that Stream mode causes per-PDF download — the first run on a year folder may take minutes.

## What This Skill Does NOT Do

- Does not open files in browser / external apps.
- Does not run `paper-close-reading` automatically (it leaves the choice to the user).
- Does not search outside Drive / Paperpile (no Notion / Confluence / etc.).
- Does not write to hubs or inbox automatically.
