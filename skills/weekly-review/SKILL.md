---
name: weekly-review
description: "Create a Japanese weekly review from ideas/daily/md/*-digest.md and relevant agent-memory Markdown files for a specified date range, or by default the current Saturday-through-Friday review window, then render ideas/weekly/YYYY-MM-DD-weekly-review.html. Use when the user asks for weekly-review, 週次レビュー, 今週の振り返り, ideas/weeklyへのreview作成, digestやmemoryから次アクションを整理, or wants weekly highlights, research signals, decisions, possible issues, and next actions."
metadata:
  short-description: "Build a weekly review from digest and memory notes"
---

# Weekly Review

Create a Japanese weekly review from daily digest notes and working-memory notes, then render the Markdown to standalone HTML.

## Repository Rules

Before writing output:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety, information-quality rules, and repo-specific storage rules.
3. Use `rg` first when searching notes and memories.

For the `life` repo, save output to:

```text
ideas/weekly/md/YYYY-MM-DD-weekly-review.md
ideas/weekly/YYYY-MM-DD-weekly-review.html
```

Use the review end date for `YYYY-MM-DD`.

## Review Window

If the user gives an explicit period, use it.

Accepted period forms include:

- `YYYY-MM-DDからYYYY-MM-DDまで`
- `YYYY-MM-DD..YYYY-MM-DD`
- `start=YYYY-MM-DD end=YYYY-MM-DD`

If no period is specified, use the local execution date:

- If execution day is Friday, review Saturday through that Friday.
- Otherwise, review from the most recent Saturday through the execution day.

The default is inclusive of both start and end dates. Always write the date range in the output.

## Sources

Primary source files:

- `ideas/inbox/YYYY-MM-DD.md` files whose date is inside the review window.
- `ideas/daily/md/YYYY-MM-DD-digest.md` files whose date is inside the review window.
- `projects/active/*.md` files with active, pending, blocked, upcoming checkpoint, or updated content relevant to the review window.
- `.agent/memories/*.md` files with `created` or `updated` inside the review window.

Optional source files:

- Read `ideas/daily/md/YYYY-MM-DD-trend.md` only if the user explicitly asks to include trend tables, or if digest coverage is absent and a short source index is needed. When using trend files, summarize only high-level signals from titles, categories, and interest scores; do not reproduce every row.

Do not read unrelated memory bodies. Search memory frontmatter first, then read only relevant files:

```bash
rg "^(summary|created|updated|status|tags):" .agent/memories -n
```

Find daily source files by date:

```bash
find ideas/daily/md -type f -name '*-digest.md' | sort
```

Find inbox source files by date:

```bash
find ideas/inbox -type f -name '*.md' | sort
```

Find project hub files:

```bash
rg "^(summary|created|updated|status|tags|related):|^## (Meetings / Checkpoints|Blockers|Next Actions)" projects/active -n
```

If there are no source files in the period, still create a short review that states the gap and suggests next actions.

## Output Sections

Write repository notes and user-facing Markdown in Japanese unless the user asks otherwise.

Use this section order:

```markdown
# Weekly Review: YYYY-MM-DD to YYYY-MM-DD

## Summary

## Highlights

## Research Signals

## Ideas Worth Keeping

## Decisions / Policy Updates

## Open Questions

## Possible Issues

## Next Actions

## Source Files
```

Section guidance:

- `Summary`: 3-5 sentences on what happened, what mattered, and what should happen next.
- `Highlights`: important items only. Do not turn this into a full log.
- `Research Signals`: patterns and research-relevant observations from digest notes. Mark inference as inference.
- `Ideas Worth Keeping`: useful inbox or digest ideas that are not ready for GitHub Issues.
- `Decisions / Policy Updates`: durable workflow, storage, or design decisions, especially from memory files.
- `Open Questions`: unresolved questions worth revisiting.
- `Possible Issues`: issue candidates in checkbox form. Do not create issues unless the user asks or invokes `issue-capture`.
- `Next Actions`: 3-5 concrete actions for the next week, including project-hub actions when relevant.
- `Source Files`: list every Markdown source file read.

## Review Rules

- Preserve source links from digest notes when useful.
- Do not paste long excerpts from source files. Paraphrase.
- Keep claims conservative. Do not overgeneralize from one paper, preprint, press release, or news item.
- For medicine, law, finance, and other high-risk topics, avoid firm conclusions and keep uncertainty visible.
- Distinguish facts from interpretation, especially in `Research Signals`.
- Prefer action-oriented bullets over archival completeness.
- Keep `Next Actions` short enough to be usable.

## Rendering

After writing or updating the Markdown review, always render HTML:

```bash
python3 <skill-dir>/scripts/render_weekly_html.py ideas/weekly/md/YYYY-MM-DD-weekly-review.md -o ideas/weekly/YYYY-MM-DD-weekly-review.html
```

The renderer embeds `assets/newsprint-weekly.css`, a Newsprint-inspired theme aligned with the daily digest/trend HTML outputs.

## Validation

After rendering:

1. Check that both Markdown and HTML files exist.
2. Run `gh project item-list` only if the user asked to update issues or Project status.
3. Report the output paths and any missing-source limitations.

## Auto-finalize

After producing both the Markdown review and the HTML, run the shared finalize script. It is a no-op unless `AGENT_AUTO_COMMIT=1` is exported in the shell. On `fenrir` this is the default; on Air / mini-lab it is unset, so this call has no effect.

```bash
bash scripts/agent_auto_finalize.sh \
  -m "docs: 📝 weekly-review: YYYY-MM-DD to YYYY-MM-DD" \
  ideas/weekly/md/YYYY-MM-DD-weekly-review.md \
  ideas/weekly/YYYY-MM-DD-weekly-review.html
```

Replace `YYYY-MM-DD` with the review end date. Pass only the weekly-review Markdown and HTML you just generated — the script commits with `-o` so other staged changes are not swept in.
