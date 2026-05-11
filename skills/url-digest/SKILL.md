---
name: url-digest
description: "Create or append a Japanese digest from a required URL into ideas/daily/md/YYYY-MM-DD-digest.md, then render ideas/daily/YYYY-MM-DD-digest.html. Use when the user says url-digest, /url-digest, digest this URL, このURLをdigest, 論文を数行でまとめて, ニュースを数行でまとめて, or wants a concise core-message summary of a paper, preprint, DOI page, publisher page, official news article, or research news URL."
metadata:
  short-description: "Digest one required URL into ideas/daily"
---

# URL Digest

## Purpose

Create a short Japanese digest from a single required URL, save the editable Markdown under the current repository's daily notes, and render a standalone HTML file for reading.

This skill is for turning interesting items found in `daily-search-trend` into reusable digest notes. Do not use existing digest files as interest-score evidence yet unless the user later changes that policy.

## Required Input

A URL is mandatory.

- If the user invokes this skill without a URL, ask for the URL and stop.
- If multiple URLs are given, process each URL as a separate section in the same daily digest file.
- Prefer primary URLs: DOI pages, publisher pages, preprint pages, official news pages, or official institution releases.

## Repository Rules

Before writing output, read the repository's `README.md` and `Rules.md` when available.

For this repo, save output to:

```text
ideas/daily/md/YYYY-MM-DD-digest.md
ideas/daily/YYYY-MM-DD-digest.html
```

Use the previous calendar day in the local timezone for `YYYY-MM-DD` unless the user specifies another date.

If the Markdown file already exists, append new URL sections. Do not overwrite previous digest entries. After every Markdown update, regenerate the HTML file.

## Workflow

1. Confirm at least one URL is present.
2. Fetch or open the URL.
3. Identify source type: paper, preprint, scientific news, research-institution release, or other.
4. Extract bibliographic/source metadata when available:
   - title
   - authors or organization
   - year or publication date
   - DOI, PMID, or preprint identifier
   - source URL
5. Read only enough to capture the core message. For papers, prioritize title, abstract, figures/headings when accessible, and conclusion/discussion if needed.
6. Write a concise Japanese digest centered on the core message, not a full summary.
7. For papers and preprints, include an author line when author metadata is available. For news and institution releases, omit author metadata unless it is central to the source page.
8. Save or append to `ideas/daily/md/YYYY-MM-DD-digest.md`, where `YYYY-MM-DD` is the previous calendar day by default.
9. Render `ideas/daily/YYYY-MM-DD-digest.html` from the Markdown source.

## Output Shape

Use one section per URL:

```markdown
## タイトル

- URL: <https://example.com>
- 種別: 論文 / プレプリント / 科学ニュース / 研究機関発表 / その他
- 著者: author list, required for papers/preprints when available
- 出典: journal, site, or organization
- 日付: YYYY-MM-DD or unknown
- DOI/ID: doi or identifier, if available

### コアメッセージ

2-4文で、このURLから持ち帰るべき中心的な内容を書く。

### メモ

- 研究や関心との接点を1-3点だけ書く。
- 不確実性や注意点がある場合だけ短く書く。
```

For papers and preprints, keep the digest grounded in the abstract and paper metadata. Avoid claiming more than the source supports.

For news or institution releases, clearly distinguish reported findings from interpretation. Do not add a `著者` line for news unless the user explicitly asks for it.

Render HTML with:

```bash
python3 <skill-dir>/scripts/render_digest_html.py ideas/daily/md/YYYY-MM-DD-digest.md -o ideas/daily/YYYY-MM-DD-digest.html
```

## Style Rules

- Write repository notes and user-facing Markdown in Japanese unless the user asks otherwise.
- Keep each digest short. The default target is about 10-20 lines per URL.
- Do not paste long excerpts. Paraphrase in your own words.
- Preserve source links.
- Mark uncertainty clearly when access is partial, abstract-only, or blocked.
- Do not use this digest corpus as the basis for `daily-search-trend` interest scoring yet.

## Refresh Portal Index

After rendering the HTML, regenerate the personal portal's daily index so the fenrir landing page (`http://fenrir:8080/`) reflects the new entry:

```bash
python3 scripts/refresh_daily_index.py
```

This rewrites `ideas/daily/index.json` from the actual file listing in `ideas/daily/`. It is fast (~ms) and idempotent. Always include `ideas/daily/index.json` in the auto-finalize call below so the regenerated index gets committed and pushed.

## Auto-finalize

After producing both the Markdown and HTML, run the shared finalize script. It is a no-op unless `AGENT_AUTO_COMMIT=1` is exported in the shell. On `fenrir` this is the default; on Air / mini-lab it is unset, so this call has no effect.

```bash
bash scripts/agent_auto_finalize.sh \
  -m "docs: 📝 url-digest: YYYY-MM-DD <one-line topic>" \
  ideas/daily/md/YYYY-MM-DD-digest.md \
  ideas/daily/YYYY-MM-DD-digest.html \
  ideas/daily/index.json
```

Replace `YYYY-MM-DD` with the digest day. Pass only the digest Markdown, HTML, and the refreshed `index.json` — the script commits with `-o` so other staged changes are not swept in.
