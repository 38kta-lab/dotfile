---
name: daily-search-trend
description: "Create Japanese daily search trend reports from PubMed, Europe PMC/bioRxiv preprint searches, Nature News, Science/AAAS News, and ナゾロジー（自然科学） for the previous calendar day, then render the Markdown to a Newsprint-themed HTML file. Use when the user asks for daily-search-trend, search trend, trend.md, trend.html, 今日の研究トレンド, 論文検索, 新着論文, 研究ニュース, 前日の論文, ideas/dailyへのtrend作成, or wants titles translated to Japanese and ranked strictly from portfolio context."
---

# Daily Search Trend

Create a Markdown trend report in the current repository from recent papers and science/news items, then render the Markdown to standalone HTML.

## Repo Context

Before running the trend:

1. Read `README.md` for the output directory policy.
2. Read `Rules.md` for safety, information-quality rules, and repo-specific digest constraints.
3. Read `portfolio/` files. Use only `portfolio/` to infer the user's research interests and score items.
4. If `portfolio/` is missing or too sparse to judge interest, state that limitation in the output and use `★★★☆☆` as a neutral provisional score. Do not infer interest from `memo.md`, `README.md`, `Rules.md`, or requested keywords.

For the `life` repo, write the editable Markdown source under `ideas/daily/md/` and the final HTML under `ideas/daily/`.

## Search Window

Use the previous calendar day as the default time window. If the skill is run on `YYYY-MM-DD`, collect items dated `YYYY-MM-DD - 1 day`.

Use day-level filters instead of strict 24-hour filters. For the `life` repo, name the output files after the target day:

- Markdown source: `ideas/daily/md/YYYY-MM-DD-trend.md`
- HTML final output: `ideas/daily/YYYY-MM-DD-trend.html`

Always use current dates from the runtime environment. Do not assume the model's knowledge is current.

## Sources

Read `references/sources.md` when choosing sources or query tactics.
Read `references/output-template.md` before writing the final Markdown.

Use the API helper first for paper/preprint search:

```bash
python3 ~/.config/codex/skills/daily-search-trend/scripts/fetch_papers.py --keywords "cyanobacteria,photosystem II,carbon fixation" --target-date YYYY-MM-DD
```

The helper queries PubMed through NCBI E-utilities and bioRxiv-like preprints through Europe PMC `SRC:PPR`. Read `references/sources.md` for API details and the selected news sources.

After writing Markdown, render HTML with:

```bash
python3 ~/.config/codex/skills/daily-search-trend/scripts/render_trend_html.py ideas/daily/md/YYYY-MM-DD-trend.md -o ideas/daily/YYYY-MM-DD-trend.html
```

The renderer embeds `assets/newsprint-trend.css`, a Newsprint-inspired theme based on Typora's Newsprint theme.

## Workflow

1. Determine paper/preprint keywords from the user request. If none are given, use the default research themes in `references/sources.md`.
2. Compute the exact target day from the runtime date or user-specified date.
3. Search PubMed by keyword with NCBI E-utilities, pinned to the exact target day with `EDAT`.
4. Search bioRxiv-relevant preprints by keyword through Europe PMC, using `SRC:PPR` and `FIRST_IDATE` pinned to the same exact target day, then filter toward bioRxiv when metadata allows.
4. Check Nature News, Science/AAAS News, and ナゾロジー（自然科学） from `references/sources.md` without keyword filtering. Collect only items posted on the target day. For Nature News and Science/AAAS News, use the official RSS feeds first, not the HTML news pages.
5. Do not check research-institution announcements by default. Check them only when the user explicitly asks for `研究機関発表` or names institutions and provides or implies a date range such as `1か月前まで`.
   - For RIKEN, build the year-specific press URL from the execution date or requested range, such as `https://www.riken.jp/press/YYYY/index.html`. If the requested range crosses years, check all relevant yearly pages.
6. Deduplicate by DOI, title, URL, and source.
7. Translate paper, preprint, and science-news titles into Japanese. For `研究機関発表`, translate only titles that are not already Japanese; leave `タイトル訳` blank for Japanese titles. Do not summarize content for this trend file.
8. Do not exclude paper/preprint or target-day news records only because they seem weakly related to the user's portfolio. Keep low-relevance records and mark them with a low interest score.
9. Score interest from 0 to 5 stars using only the `portfolio/` context:
   - `★★★★★`: directly relevant to the user's core research or likely actionable soon
   - `★★★★☆`: strongly adjacent or useful for research planning
   - `★★★☆☆`: generally relevant background or trend
   - `★★☆☆☆`: weakly adjacent, mostly FYI
   - `★☆☆☆☆`: low relevance, included only for completeness
   - `☆☆☆☆☆`: no clear relevance to the portfolio, but retained to avoid hidden filtering
10. For papers and preprints, set `カテゴリ` to matched search-keyword tags such as `#cyanobacteria #photosynthesis` instead of generic `論文` or `プレプリント`.
11. For English science/news and non-Japanese research-institution announcement items, use `原文タイトル`, `タイトル訳`, and `興味度`. For Japanese science/news and Japanese research-institution announcement items, omit `タイトル訳` and use only `原文タイトル` and `興味度`.
12. Write one Markdown file to `ideas/daily/md/YYYY-MM-DD-trend.md`, using the target day in the filename, unless the user specifies another topic slug.
13. Render `ideas/daily/YYYY-MM-DD-trend.html` from that Markdown with `scripts/render_trend_html.py`. Treat the HTML as the final user-facing output and the Markdown as the source.
14. Include source URLs, target date, keywords, and portfolio files used.

## Exact-Day Guardrail

Do not finalize the PubMed or Europe PMC sections from a rolling `24h` window alone.

- For PubMed, the final adoption step must use `YYYY/MM/DD[EDAT] : YYYY/MM/DD[EDAT]`.
- For Europe PMC preprints, the final adoption step must use `FIRST_IDATE:[YYYY-MM-DD TO YYYY-MM-DD]` for the same target day.
- If a helper was first run with `--hours 24` for rough collection, rerun or reconfirm with `--target-date YYYY-MM-DD` before writing the Markdown.
- When a record's displayed `pubdate` looks different from the target day but the entry date matches the target day, it may still be retained if the exact-day query returned it.

## Output Rules

Write repository notes and user-facing Markdown in Japanese unless the user asks otherwise.

Keep claims conservative. Do not overgeneralize from one paper, preprint, press release, or news post.

Separate papers/preprints and science/news site items by source.

Use this table shape for papers and preprints:

```markdown
| 原文タイトル | タイトル訳 | 興味度 | カテゴリ |
|---|---|---|---|
```

Use this table shape for English science/news and non-Japanese research-institution announcement sources:

```markdown
| 原文タイトル | タイトル訳 | 興味度 |
|---|---|---|
```

Use this table shape for Japanese science/news and Japanese research-institution announcement sources:

```markdown
| 原文タイトル | 興味度 |
|---|---|
```

Put the source URL into `原文タイトル` as a Markdown link: `[Original Title](https://...)`.

For Nature News, use `https://www.nature.com/nature.rss` as the primary source and filter entries by `dc:date`. Use `https://www.nature.com/news` only as a human browser reference. If the RSS feed fails, fall back to a domain-constrained web search for `site:nature.com/articles/d41586` plus the target date.

For Science/AAAS News, use `https://www.science.org/rss/news_current.xml` as the primary source and filter entries by `dc:date` or `prism:coverDate`. Use `https://www.science.org/news` only as a human browser reference. If the RSS feed fails, fall back to a domain-constrained web search for `site:science.org/content/article` plus the target date.

For `研究機関発表`, leave `タイトル訳` blank when the original title is already Japanese. Fill `タイトル訳` only when the original title is not Japanese.

Do not include content summaries in `YYYY-MM-DD-trend.md`. Save deeper summaries for a separate future `daily-research-digest` skill.

Do not include empty source sections. If Nature News, Science/AAAS News, ナゾロジー（自然科学）, or a requested institution has no target-day results, omit that source section from the output.

Do not add `興味度の判断メモ` or `制限・不確実性` sections to the daily trend output.

Always generate or update the HTML file after changing the Markdown trend file.
