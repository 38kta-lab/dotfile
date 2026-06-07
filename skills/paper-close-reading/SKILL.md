---
name: paper-close-reading
description: "Create a paper close-reading workflow from a prepared PDF, raw HTML, and figure images. Always make clean-original.html as Step 1, then write the Japanese close-reading as <slug>-ja.md (canonical, git-tracked, editable). render_all.sh renders ja.md into a self-contained <slug>-ja.html with embedded figures, served by fenrir_portal at http://fenrir:8080/paper/. Use when the user says paper-close-reading, 論文精読, clean-original.html, original.html, ja.md, 精読メモ, or wants a prepared paper tmp directory turned into readable original (embedded HTML) + ja (markdown canonical + portal HTML) artifacts."
metadata:
  short-description: "論文PDF+raw HTML+図から clean-original.html (英) + <slug>-ja.md (canonical) を作り、portal が ja.html を embedded で配信"
---

# Paper Close Reading

## Purpose

Turn a prepared paper staging directory into 3 reading artifacts:

1. `clean-original.html` — English clean text + embedded figures (kept in `tmp/` as the reading source, not committed)
2. **`<slug>-ja.md`** — **canonical** Japanese close-reading: section summaries, figure interpretation, 批判的コメント (markdown, git-tracked, human-editable)
3. `<slug>.md` — lightweight index: title, authors, DOI, journal, links, summary (git-tracked)

`render_all.sh` then renders both markdown files to `~/.local/share/life/_life/paper/`, embedding local image references (`tmp/Fig.1.png` etc.) as data: URIs. fenrir_portal serves the result at:

- `http://fenrir:8080/paper/<slug>.html` — index page
- `http://fenrir:8080/paper/<slug>-ja.html` — full Japanese close-reading with embedded figures

`clean-original.html` is always Step 1. It is the required foundation for everything that follows.

## Expected Input

The user has already prepared a staging directory containing at least:

- paper PDF
- raw HTML saved from the browser console, OR fetched via `scripts/papers/fetch_html.py <publisher-url>`
- extracted figure images such as `Fig.1.png`, `Fig.2.png`, ...

In the `life` repo, this usually means:

```text
portfolio/paper-close-readings/tmp/
```

Before writing output, read the current repository's `README.md` and `Rules.md` when available.

## Required Workflow

1. Inspect the staging directory and identify the raw HTML, PDF, and figure files.
2. **Step 1: Create `tmp/clean-original.html`**.
   - Keep the article body, figures, tables, and references.
   - Remove surrounding publisher UI, related-content blocks, and other page chrome.
   - Preserve the original English text.
   - Embed figure references (`src="Fig.1.png"`) as data: URIs using `embed_local_images_in_html.py`.
3. Create or refresh `tmp/original.html` if a broader original reading copy is useful.
4. **Step 2: Write `<slug>-ja.md`** at `portfolio/paper-close-readings/<slug>-ja.md` based on `clean-original.html`.
   - Use the paper's own section structure as the spine.
   - Summarize `Introduction`, `Materials and methods`, `Results and discussion`, `Conclusions` in Japanese.
   - Reference figures inline with markdown image syntax: `![Fig.1: caption](tmp/Fig.1.png)`. These will be embedded automatically during render.
   - Always include a `## 批判的コメント` section.
5. **Step 3: Write `<slug>.md`** index at `portfolio/paper-close-readings/<slug>.md` with title / authors / DOI / journal / one-line summary / links to ja and original.
6. **Render to portal**: run `bash scripts/render_all.sh` (or rely on the next scheduled render). render_all.sh resolves the `tmp/` image paths relative to the source `.md` location and embeds them as data: URIs in the portal HTML.

## Step 1 Rule

`clean-original.html` creation is mandatory.

Treat it as:

- the first stable artifact
- the source for later Japanese structuring
- the minimum English reading artifact worth preserving

Do not start by writing `<slug>-ja.md` from raw publisher HTML directly. Always pass through clean-original first so the Japanese version inherits a clean section structure.

## Repository-Specific Convention For life

When working inside the `life` repo:

- **staging area**: `portfolio/paper-close-readings/tmp/` (gitignored, contains PDFs / raw HTML / figures / `clean-original.html`)
- **canonical artifacts** (git-tracked, in `portfolio/paper-close-readings/`):
  - `<slug>.md` — lightweight index
  - `<slug>-ja.md` — full Japanese close-reading
- **portal output** (gitignored, auto-rendered to `~/.local/share/life/_life/paper/`):
  - `<slug>.html` — index, served by Caddy at `http://fenrir:8080/paper/<slug>.html`
  - `<slug>-ja.html` — Japanese close-reading with embedded images, served at `http://fenrir:8080/paper/<slug>-ja.html`

The `<slug>.md` index is for:

- title, authors, DOI, journal
- local paths (clean-original.html in tmp/, ja.md, ja.html)
- Drive / Paperpile links
- one-line summary
- figure roles (1-2 lines)
- strong conclusions
- weaknesses / unresolved points
- critical comments (high-level — full version in `<slug>-ja.md`)
- next reading targets

Do not commit PDFs, raw figure assets, or `clean-original.html` (= all live in `tmp/`).

## clean-original.html Rules

- Preserve the full original text of the body.
- Keep major article sections.
- Keep figure and table references readable.
- Keep references unless the user explicitly says to drop them.
- Prefer readability over publisher fidelity.
- Treat publisher structure as variable. Do not assume Springer-only markup.
- When the auto cleaner lands on a too-broad wrapper, trim obvious site chrome manually but keep the article text complete.
- After cleaning, embed local figures so it stays portable when reading offline.

Use the bundled script in `auto` mode first:

```bash
python3 <skill-dir>/scripts/make_clean_original.py RAW_HTML tmp/clean-original.html
python3 scripts/embed_local_images_in_html.py tmp/clean-original.html
```

The cleaner is publisher-agnostic by default and tries multiple DOM families:

- `Nature / Springer` style article bodies
- `PLOS` style `#artText` bodies
- generic `<article>` wrappers
- generic `<main>` wrappers

If `auto` mode fails, fall back to refreshing the raw HTML (`scripts/papers/fetch_html.py`) so the body is available as `article` or `main` content, then rerun Step 1.

## ja.md Rules

Use the paper's own structure, then translate and reorganize into readable Japanese.

Minimum expected sections (as markdown headings):

- `## Abstract`
- `## 導入の要点`
- `## Materials and methods 日本語整理`
- `## Results and discussion 日本語整理`
- `## Discussion の要点` if separable from results
- `## Conclusions の要点`
- `## 批判的コメント` (mandatory, even when the paper is strong)
- `## 次に読むポイント`

Figure references use markdown image syntax with paths relative to the source `.md`:

```markdown
![Fig.1: Phylogenetic tree of bilin reductases](tmp/Fig.1.png)
```

The image will be inlined as a data: URI when render_all.sh produces the portal HTML — no manual embedding step needed for `<slug>-ja.md`.

Always:

- distinguish what the data directly show from the authors' model
- mark limitations and uncertainty clearly
- leave critical comments even if the paper is strong

Read `references/ja-html-template.md` for the expected Japanese tone (the template is HTML-flavored but the structure carries over to markdown).

## Visual Style Rule

Use the `daily-search-trend` Newsprint-inspired CSS direction. The Newsprint CSS is automatically applied to portal HTML by `scripts/render_md.py` — no per-document style work needed for `<slug>-ja.html`.

For `tmp/clean-original.html` (which is hand-cleaned from publisher HTML), keep restrained paper-like colors, thin rules, and readable serif typography. Avoid app-like card dashboards unless the user explicitly asks for a different visual language.

## Self-Contained Output Rule

The portal HTML produced from `<slug>-ja.md` must have all `tmp/Fig.*.png` references embedded as data: URIs. This is handled automatically by `scripts/render_all.sh`'s paper render pass (it calls `embed_local_images_in_html.py --base-dir <source-dir>` so the figures resolve from `portfolio/paper-close-readings/tmp/`).

For `tmp/clean-original.html`, embed images explicitly:

```bash
python3 scripts/embed_local_images_in_html.py tmp/clean-original.html
```

This makes the clean-original portable for offline reading even though it is not committed.

## Output Checklist

Before finishing, verify:

- `tmp/clean-original.html` exists, opens as valid HTML, has embedded `data:image` URIs
- `portfolio/paper-close-readings/<slug>-ja.md` exists with markdown image references like `![Fig.1: ...](tmp/Fig.1.png)`
- `portfolio/paper-close-readings/<slug>.md` index references both files
- `## 批判的コメント` section is present in `<slug>-ja.md`
- After `bash scripts/render_all.sh`: `~/.local/share/life/_life/paper/<slug>.html` and `<slug>-ja.html` exist, and ja.html contains embedded `data:image` URIs (verify with `grep -c 'data:image' <slug>-ja.html`)

## References

- `references/ja-html-template.md`: expected Japanese reading-note structure (HTML format, but the section flow applies to markdown too)

## Auto-finalize

After producing `<slug>-ja.md` and `<slug>.md`, run the shared finalize script. It is a no-op unless `AGENT_AUTO_COMMIT=1` is exported in the shell. On `fenrir` this is the default; on Air / mini-lab it is unset, so this call has no effect.

```bash
bash scripts/agent_auto_finalize.sh \
  -m "docs: 📝 paper-close-reading: <paper short title>" \
  portfolio/paper-close-readings/<slug>-ja.md \
  portfolio/paper-close-readings/<slug>.md
```

Pass only the canonical markdown files — never the PDF, raw HTML, figure assets, or `clean-original.html` (all live in `tmp/`, which is gitignored). The script commits with `-o` so other staged changes are not swept in.
