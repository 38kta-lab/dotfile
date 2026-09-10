---
name: lab-os-trend
description: "Generate a lab-relevant new-paper trend digest for the Masuda Lab and push it to lab-OS. Fetch recent PubMed/EuropePMC papers with the lab keyword set, score each by RELEVANCE TO THE LAB'S PAST PAPERS (not the user's personal interest), write a concise Japanese Markdown digest plus a one-line highlight, and POST it to the lab-OS ingest API so it appears in お知らせ + the 研究トレンド page. Use for lab-os-trend, lab trend, 研究室トレンド, lab-OS 新着論文, ラボ関連の論文トレンド."
---

# lab-OS Trend

Build a **lab-relevant** new-paper trend for the 増田研 (Masuda Lab) and push it to lab-OS
(https://ymir.tail175f64.ts.net). This is separate from `daily-search-trend` (which scores by the
user's personal `portfolio/`). Here, score by **relevance to the lab's past papers**.

## What is different from daily-search-trend

- **Scope**: papers/preprints only. No Nature/Science/ナゾロジー news, no HTML render, no portal index.
- **Scoring basis**: `references/lab-corpus.md` (lab themes + past-paper titles) — NOT `portfolio/`.
- **Output**: a Japanese Markdown digest + a 1-line highlight, **POSTed to lab-OS** (not written to ideas/daily/).

## Dates (newspaper model)

Two distinct dates:

- **Fetch date** = the **previous calendar day** (`date -v-1d +%F`) — the papers to collect.
- **Generation / label date** = **today** (`date +%F`) — the date the digest is filed under in lab-OS.

So "today's issue" covers yesterday's new papers. Fetch with `--target-date <fetch>`, but push with
`--date <today>`. The lab-OS entry slug becomes `trend-<today>`. Mention the coverage day in the digest footer.

## Workflow

1. **Dates**: fetch = previous day, label/push = today (see above). Accept explicit overrides if given.
2. **Read** `references/lab-corpus.md` for the lab keyword set and the past-paper corpus. Use ONLY this to judge relevance.
3. **Fetch** candidates with the shared fetcher (reuse daily-search-trend's script):
   ```bash
   python3 ~/.claude/skills/daily-search-trend/scripts/fetch_papers.py \
     --keywords "phycobilin,bilin reductase,ferredoxin-dependent bilin reductase,phytochrome,cyanobacteriochrome,phycobiliprotein,chromatic acclimation,chlorophyll f,far-red light photoacclimation,tetrapyrrole biosynthesis,heme oxygenase,biliverdin,phycocyanobilin,stercobilin,bilirubin reductase" \
     --target-date YYYY-MM-DD
   ```
   (Keep the keyword list in sync with `references/lab-corpus.md`.) An NCBI API key in `~/.config/life/ncbi.env` (if present) raises the rate limit.
4. **Deduplicate** by DOI / title / URL.
5. **Score each** candidate 0–5 by closeness to the lab corpus (themes + past-paper titles):
   - `★★★★★` core lab topic (e.g. a new FDBR / bilin reductase structure, phycobilin/phytochrome mechanism, Acaryochloris/far-red photoacclimation, iBR/gut bilin).
   - `★★★★☆` strongly adjacent (tetrapyrrole/heme, cyanobacterial photosynthesis, chromatic acclimation).
   - `★★★☆☆` generally related background.
   - `★★☆☆☆` / `★☆☆☆☆` weak. Do **not** silently drop low items; keep a short tail.
   - Judge relevance to the LAB, not to the reader.
6. **Write** the digest as Markdown (Japanese), ranked by relevance:
   - `## 注目`（★★★★ 以上）: 各項目 1–2 行。**日本語タイトル** — なぜラボに関連するか一言、`★`、DOI/URL リンク。
   - `## その他`（★★★ 以下）: タイトル＋`★`＋リンクの短い箇条書き。
   - 該当が無い日は `本日はラボ関連の新着はありませんでした。` の1行のみ。
   - 保守的に。1本の論文から過度に一般化しない。
7. **Highlight**: choose a single one-line Japanese highlight = the most lab-relevant finding of the day (shown in lab-OS お知らせ). If nothing notable, use a neutral one-liner.
8. **Push** to lab-OS with the **generation date (today)**, not the fetch date. Write the digest to a temp file and POST:
   ```bash
   python3 <skill-dir>/scripts/push_trend.py --date <today> \
     --highlight "<1行ハイライト>" --md /tmp/labos-trend-<today>.md
   ```
   `push_trend.py` needs `LABOS_INGEST_TOKEN` (and optionally `LABOS_URL`) in the environment — the cron
   wrapper sources `~/.config/life/labos.env`. On success it prints `200 {"ok": true, ...}`.

## Safety / rules

- Japanese output. Primary sources only (PubMed/EuropePMC via the fetcher; DOI links).
- Never invent papers or DOIs; only include records the fetcher returned for the target day.
- The digest is pushed to a login-gated lab wiki — no secrets, no personal data.
- Do not write to `ideas/daily/` or render HTML (that is daily-search-trend's job).
- This skill is idempotent per day: pushing again for the same date updates the same lab-OS entry.
