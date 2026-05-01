---
name: paper-close-reading
description: "Create a paper close-reading workflow from a prepared PDF, raw HTML, and figure images. Always make clean-original.html as Step 1, then build a Japanese ja.html with section-by-section summaries and critical comments, and finally convert both HTML files into self-contained embedded-image outputs. Use when the user says paper-close-reading, 論文精読, clean-original.html, original.html, ja.html, 精読メモ, or wants a prepared paper tmp directory turned into readable original/ja HTML artifacts."
metadata:
  short-description: "論文PDF+raw HTML+図から clean-original と ja.html を作る。"
---

# Paper Close Reading

## Purpose

Turn a prepared paper staging directory into two reading artifacts:

1. `clean-original.html`
2. `ja.html`

Then convert both into self-contained embedded-image HTML files. Treat the embedded versions as the required final outputs, not as an optional cleanup step.

`clean-original.html` is always Step 1. It is the required foundation for everything that follows.

## Expected Input

The user has already prepared a staging directory containing at least:

- paper PDF
- raw HTML saved from the browser console
- extracted figure images such as `Fig.1.png`, `Fig.2.png`, ...

In the `life` repo, this usually means:

```text
portfolio/paper-close-readings/tmp/
```

Before writing output, read the current repository's `README.md` and `Rules.md` when available.

## Required Workflow

1. Inspect the staging directory and identify the raw HTML, PDF, and figure files.
2. Create `clean-original.html` first.
   - Keep the article body, figures, tables, and references.
   - Remove surrounding publisher UI, related-content blocks, and other page chrome.
   - Preserve the original English text.
3. Create or refresh `original.html` if the workflow benefits from a broader original reading copy.
4. Create `ja.html` based on the `clean-original.html` structure.
   - Use the paper's own section structure as the spine.
   - Summarize `Introduction`, `Materials and methods`, `Results and discussion`, and `Conclusions` in Japanese.
   - Keep figure-by-figure interpretation where it matters.
   - Always include `批判的コメント`.
5. Convert `clean-original.html` and `ja.html` into self-contained HTML by embedding all local figure references, including both `src` and `srcset`.
6. If the repo has an index note for the paper, update it with local paths, Drive links, and next reading targets.

## Step 1 Rule

`clean-original.html` creation is mandatory.

Treat it as:

- the first stable artifact
- the source for later Japanese structuring
- the minimum English reading artifact worth preserving

Do not start by writing `ja.html` from raw publisher HTML directly.

## Repository-Specific Convention For life

When working inside the `life` repo:

- staging area: `portfolio/paper-close-readings/tmp/`
- lightweight index note: `portfolio/paper-close-readings/YYYY-MM-DD-*.md`

The repo note is for:

- title, authors, DOI, journal
- local paths
- Drive links
- one-line summary
- figure roles
- strong conclusions
- weaknesses / unresolved points
- critical comments
- next reading targets

Do not commit PDFs or raw figure assets.

## clean-original.html Rules

- Preserve the full original text of the body.
- Keep major article sections.
- Keep figure and table references readable.
- Keep references unless the user explicitly says to drop them.
- Prefer readability over publisher fidelity.
- Treat publisher structure as variable. Do not assume Springer-only markup.
- When the auto cleaner lands on a too-broad wrapper, trim obvious site chrome manually but keep the article text complete.

Use the bundled script in `auto` mode first:

```bash
python3 <skill-dir>/scripts/make_clean_original.py RAW_HTML OUTPUT_HTML
```

The cleaner is publisher-agnostic by default and currently tries multiple DOM families, including:

- `Nature / Springer` style article bodies
- `PLOS` style `#artText` bodies
- generic `<article>` wrappers
- generic `<main>` wrappers

If `auto` mode fails, do not abandon the workflow. Fall back to the browser-console capture step and refresh the raw HTML so that the article body is available as `article` or `main` content, then rerun Step 1.

## ja.html Rules

Use the paper's own structure, then translate and reorganize into readable Japanese.

Minimum expected sections:

- `Abstract`
- `導入の要点`
- `Materials and methods 日本語整理`
- `Results and discussion 日本語整理`
- `Discussion の要点` if separable
- `Conclusions の要点`
- `批判的コメント`
- `次に読むポイント`

Always:

- distinguish what the data directly show from the authors' model
- mark limitations and uncertainty clearly
- leave critical comments even if the paper is strong

Read `references/ja-html-template.md` before writing `ja.html`.

## Visual Style Rule

Use the `daily-search-trend` Newsprint-inspired CSS direction as the baseline visual style for both `clean-original.html` and `ja.html`.

- paper pages should look like the same family as `trend.html`
- prefer restrained paper-like colors, thin rules, and readable serif typography
- avoid app-like card dashboards unless the user explicitly asks for a different visual language

## Self-Contained Output Rule

Both final artifacts must be self-contained HTML with embedded images whenever local figures are present. Relative local image references must not remain in the final deliverables.

Use:

```bash
python3 <skill-dir>/scripts/embed_local_images_in_html.py clean-original.html ja.html
```

Do this before considering the step complete. The deliverable is the embedded version itself.

## Output Checklist

Before finishing, verify:

- `clean-original.html` exists
- `ja.html` exists
- both still open as valid HTML
- both contain embedded `data:image` URLs when local figures were present
- neither file retains local relative image references such as `src="Fig.1.png"` or `srcset="Fig.1.png"`
- the index `md` mentions where the canonical or editable copies live
- `批判的コメント` is present in `ja.html`

## References

- `references/ja-html-template.md`: expected Japanese reading-note structure

## Auto-finalize

After producing the embedded `clean-original.html` and `ja.html`, and updating the lightweight index Markdown, run the shared finalize script. It is a no-op unless `AGENT_AUTO_COMMIT=1` is exported in the shell. On `fenrir` this is the default; on Air / mini-lab it is unset, so this call has no effect.

```bash
bash scripts/agent_auto_finalize.sh \
  -m "docs: 📝 paper-close-reading: <paper short title>" \
  portfolio/paper-close-readings/tmp/clean-original.html \
  portfolio/paper-close-readings/tmp/ja.html \
  portfolio/paper-close-readings/YYYY-MM-DD-<slug>.md
```

Pass only the HTML artifacts and the index Markdown — never the PDF, raw HTML, or figure assets (per the "Do not commit PDFs or raw figure assets" rule). The script commits with `-o` so other staged changes are not swept in. Adjust the path list when the actual deliverable file set differs (for example, if `original.html` was also produced and should be committed).
