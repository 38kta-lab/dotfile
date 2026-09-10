---
name: lab-os-trend
description: "Generate a lab-relevant new-paper trend digest for the Masuda Lab and push it to lab-OS. Fetch recent PubMed/EuropePMC papers with the lab keyword set, score each by RELEVANCE TO THE LAB'S PAST PAPERS (not the user's personal interest), write a concise Japanese Markdown digest plus a one-line highlight, and POST it to the lab-OS ingest API so it appears in お知らせ + the 研究トレンド page. Use for lab-os-trend, lab trend, 研究室トレンド, lab-OS 新着論文, ラボ関連の論文トレンド."
---

# lab-OS Trend

Build a **lab-relevant** new-paper trend for the 増田研 (Masuda Lab) and push it to lab-OS
(https://ymir.tail175f64.ts.net). This is separate from `daily-search-trend` (which scores by the
user's personal `portfolio/`). Here, score by **relevance to the lab's past papers**.

## What is different from daily-search-trend

- **Sources**: PubMed (NCBI E-utilities) **＋ Europe PMC の bioRxiv プレプリント（SRC:PPR）** — fetch_papers.py が両方を叩く。NCBI 単独ではない。Nature/Science/ナゾロジーの news は含めない（論文トレンドに特化）。HTML/portal も無し。
- **Keywords**: 広い anchor 語＋焦点語の二層（`references/lab-corpus.md`）。広い語が毎日の量を確保し、焦点語がニッチを射抜く。過広な当たりは関連度採点で沈む。
- **Scoring basis**: `references/lab-corpus.md`（ラボのテーマ＋過去論文）— NOT `portfolio/`.
- **Output**: 日本語 Markdown digest ＋ 1行ハイライトを **lab-OS へ POST**（ideas/daily/ には書かない）。

## Dates (newspaper model)

Two distinct dates:

- **Fetch date** = the **previous calendar day** (`date -v-1d +%F`) — the papers to collect.
- **Generation / label date** = **today** (`date +%F`) — the date the digest is filed under in lab-OS.

So "today's issue" covers yesterday's new papers. Fetch with `--target-date <fetch>`, but push with
`--date <today>`. The lab-OS entry slug becomes `trend-<today>`. Mention the coverage day in the digest footer.

## Workflow

1. **Dates**: fetch = previous day, label/push = today (see above). Accept explicit overrides if given.
2. **Read** `references/lab-corpus.md` for the lab keyword set and the past-paper corpus. Use ONLY this to judge relevance.
3. **Fetch** candidates with the shared fetcher. **The keyword list lives ONLY in `references/lab-corpus.md`** (the "検索キーワード" line) — read it from there and pass it verbatim (do not hardcode a copy here):
   ```bash
   python3 ~/.claude/skills/daily-search-trend/scripts/fetch_papers.py \
     --keywords "<comma-joined keywords from references/lab-corpus.md>" \
     --target-date <fetch>
   ```
   An NCBI API key in `~/.config/life/ncbi.env` (if present) raises the rate limit.
4. **Deduplicate** by DOI / title / URL.
5. **Score each** candidate 0–5 by closeness to the lab corpus (themes + past-paper titles):
   - `★★★★★` core lab topic (e.g. a new FDBR / bilin reductase structure, phycobilin/phytochrome mechanism, Acaryochloris/far-red photoacclimation, iBR/gut bilin).
   - `★★★★☆` strongly adjacent (tetrapyrrole/heme, cyanobacterial photosynthesis, chromatic acclimation).
   - `★★★☆☆` generally related background.
   - `★★☆☆☆` / `★☆☆☆☆` weak. Do **not** silently drop low items; keep a short tail.
   - Judge relevance to the LAB, not to the reader.
6. **Write** the digest as Markdown, **relevance order (highest ★ first)**. **各項目は「英語の原文タイトルをそのまま（リンク）＋★関連度」を見出しにし、その下に日本語訳を置く**（daily-trend の 原文タイトル/タイトル訳 方式）。勝手に和文へ言い換えず、原題を verbatim で出す。
   - 各項目の形（1件・全 tier 共通）：
     ```
     - **[<original English title verbatim>](<pubmed url>)** ★★★★☆
       訳: <日本語訳>  ・ [DOI](https://doi.org/…)
     ```
   - **関連度の理由や「〜研究に直結」等の判断コメントは書かない**（英語原題＋★＋訳のみ）。読者が★とタイトルで判断する。
   - `## 注目`（★★★ 以上・ラボ過去論文に近い） / `## その他`（★★ 以下・広い語での一般ヒット）で 2 段に分けるだけ。**取りこぼさず全件**載せる（研究トレンドページは全件を見せる）。件数が非常に多い日は ★☆ を末尾へ。
   - 該当（★★★以上）が無い日は「本日はラボ関連の注目新着はありませんでした。」＋その他に一般ヒットを列挙。
   - 原文が日本語の記事はそのまま（訳は省略）。Footer 行に対象日（fetch 日）を明記。保守的に、1本から過度に一般化しない。
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
