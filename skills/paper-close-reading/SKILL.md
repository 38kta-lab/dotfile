---
name: paper-close-reading
description: "Create a paper close-reading workflow from a prepared PDF, raw HTML, and figure images. Always make clean-original.html as Step 1, then write the Japanese close-reading as <slug>-ja.md (canonical, git-tracked, editable). render_all.sh renders ja.md into a self-contained <slug>-ja.html with embedded figures, served by fenrir_portal at http://fenrir:8080/paper/. Use when the user says paper-close-reading, 論文精読, clean-original.html, original.html, ja.md, 精読メモ, or wants a prepared paper tmp directory turned into readable original (embedded HTML) + ja (markdown canonical + portal HTML) artifacts."
metadata:
  short-description: "論文PDF+raw HTML+図から clean-original.html (英) + <slug>-ja.md (canonical) を作り、portal が ja.html を embedded で配信"
---

# Paper Close Reading

## Purpose

Turn a prepared paper staging directory into 3 reading artifacts:

1. `clean-original.html` — English clean text + embedded figures (kept in `tmp/<slug>/` as the reading source, not committed)
2. **`<slug>-ja.md`** — **canonical** Japanese close-reading: section summaries, figure interpretation, 批判的コメント (markdown, git-tracked, human-editable)
3. `<slug>.md` — lightweight index: title, authors, DOI, journal, links, summary (git-tracked)

`render_all.sh` then renders both markdown files to `~/.local/share/life/_life/paper/`, embedding local image references (`tmp/<slug>/Fig.1.png` etc.) as data: URIs **resized to a 1200px max width via Pillow** (so portal pages stay reasonable in size and figures look visually consistent). It also regenerates `portfolio/paper-close-readings/README.md` Link 集 table from a glob so the new paper appears on the portal index automatically. fenrir_portal serves the result at:

- `http://fenrir:8080/paper/` — auto-updated paper index (`README.html`)
- `http://fenrir:8080/paper/<slug>.html` — per-paper index page
- `http://fenrir:8080/paper/<slug>-ja.html` — full Japanese close-reading with embedded figures (max-width 1200px, `<figure class="md-figure">` styled via Newsprint CSS)

`clean-original.html` is always Step 1. It is the required foundation for everything that follows.

## Per-Paper tmp Subdirectory (REQUIRED)

Every paper's staging assets live in their **own per-slug subdirectory**, never in bare `tmp/`:

```text
portfolio/paper-close-readings/tmp/<slug>/
  original.html        clean-original.html        full.txt
  Fig.1.png  Fig.2.png  ...  Fig.N.png
```

where `<slug>` is the exact paper slug (= the `<slug>-ja.md` filename stem, e.g.
`2026-06-08-pleyer-iron-porphyrin-biosignature`).

**Why:** bare `tmp/` is shared scratch — the *next* paper's fetch overwrites it. If `<slug>-ja.md`
references bare `tmp/Fig.1.png`, then after the next paper is staged those references silently point
to a *different* paper's figures. A future re-render of the old `ja.md` would then embed the wrong
images. Per-slug subdirectories make each paper self-contained, so references never go stale and
`tmp/` itself stays empty between papers.

**Therefore, throughout this skill, every `tmp/...` path means `tmp/<slug>/...`:**

- staging input: `tmp/<slug>/original.html`, `tmp/<slug>/Fig.N.png`
- Step 1 output: `tmp/<slug>/clean-original.html`
- `<slug>-ja.md` figure refs: `![Fig.1: caption](tmp/<slug>/Fig.1.png)`
- `<slug>.md` index clean-original path: `tmp/<slug>/clean-original.html`

`render_all.sh` resolves these relative to the `.md` location, so the subdir path works unchanged.

**Step 0 (do this first):** determine the slug from the paper metadata, then
`mkdir -p portfolio/paper-close-readings/tmp/<slug>/` and fetch/stage all assets into it.
If the user pre-staged files in bare `tmp/`, move them into `tmp/<slug>/` before Step 1.

## Expected Input

The staging directory is the per-slug subdir (see "Per-Paper tmp Subdirectory" above):

```text
portfolio/paper-close-readings/tmp/<slug>/
```

There are two input modes — prefer **HTML mode** when available, fall back to **PDF mode** when not.

### HTML mode (preferred)

- `tmp/<slug>/original.html` — raw page HTML from the publisher (with full body, figures, references)
- `tmp/<slug>/Fig.1.png` (or `.jpg`) ... `tmp/<slug>/Fig.N.png` — extracted figure images

This mode supports accurate text and structure-preserving rendering. Acquire HTML via either:

- `scripts/papers/fetch_html.py <publisher-url>` — playwright + stealth + UTokyo institutional IP, passes Cloudflare and gives full figure markup
- Browser "Save Page As → Web Page Complete" if scripted fetch is blocked

### PDF mode (fallback)

Use this mode when HTML cannot be obtained:

- Cloudflare / anti-bot blocks `fetch_html.py` even with stealth
- Publisher has no web HTML edition (book chapters, some preprint servers)
- Off-campus and no EZproxy access
- Paywall blocks HTML but PDF is accessible (e.g. via Paperpile)

Inputs:

- `tmp/<slug>/<author-year>.pdf` — the PDF file (often already in Paperpile: `~/Library/CloudStorage/GoogleDrive-38kta.lab@gmail.com/マイドライブ/Paperpile/<year>/...pdf`)
- `tmp/<slug>/Fig.1.png` ... `tmp/<slug>/Fig.N.png` — figures extracted manually (e.g. macOS Preview "export as image", or `pdftoppm` from poppler)

In PDF mode you skip Step 1 (`clean-original.html`) — there is no clean HTML to produce. Run `pdftotext -layout tmp/<slug>/<...>.pdf tmp/<slug>/full.txt` (poppler) once to get text, then read directly from the PDF (or text dump) when writing `<slug>-ja.md`. Note that pdftotext loses table layout and may garble special characters / multi-column flow — flag any ambiguous extraction in the close-reading 批判的コメント section if it affects the conclusion.

### Mode declaration

In the index `<slug>.md`, declare which mode was used so future you (and search) can find it:

```markdown
---
input_mode: html   # or: pdf
...
---
```

Before writing output, read the current repository's `README.md` and `Rules.md` when available.

## Required Workflow

0. **Step 0: Determine the slug** and `mkdir -p portfolio/paper-close-readings/tmp/<slug>/`. Fetch/stage all assets (raw HTML, figures, PDF) into that subdir. Move any pre-staged bare-`tmp/` files into `tmp/<slug>/`.
1. Inspect `tmp/<slug>/`. Determine **HTML mode** (raw `original.html` available) vs **PDF mode** (only PDF + figures). Record the mode in the index `<slug>.md` frontmatter as `input_mode: html` or `input_mode: pdf`.
2. **Step 1: Create `tmp/<slug>/clean-original.html`** — only in HTML mode. In PDF mode skip this step and proceed directly to Step 2.
   - Keep the article body, figures, tables, and references.
   - Remove surrounding publisher UI, related-content blocks, and other page chrome.
   - Preserve the original English text.
   - Embed figure references (`src="Fig.1.png"`) as data: URIs using `embed_local_images_in_html.py` (optionally with `--max-width 1200` for smaller offline copy).
3. (HTML mode only) Create or refresh `tmp/<slug>/original.html` if a broader original reading copy is useful.
4. **Step 2: Write `<slug>-ja.md`** at `portfolio/paper-close-readings/<slug>-ja.md` based on `clean-original.html` (HTML mode) or PDF text + visual reading (PDF mode).
   - Use the paper's own section structure as the spine.
   - Summarize `Introduction`, `Materials and methods`, `Results and discussion`, `Conclusions` in Japanese.
   - Reference figures inline with markdown image syntax: `![Fig.1: caption](tmp/<slug>/Fig.1.png)`. These will be embedded automatically during render. **Keep `[` / `]` out of the alt text** (e.g. write `FeCl(oep)` not `[FeCl(oep)]`) — square brackets in the alt break markdown `![...]()` image parsing and the figure silently fails to embed.
   - Always include a `## 批判的コメント` section. In PDF mode, also flag any text-extraction uncertainty (table layout / equations / multi-column flow) so future you knows what to re-verify.
5. **Step 3: Write `<slug>.md`** index at `portfolio/paper-close-readings/<slug>.md` with `input_mode`, title, authors, DOI, journal, one-line summary, links to ja and original.
6. **Render to portal**: run `bash scripts/render_all.sh` (or rely on the next scheduled render). render_all.sh resolves the `tmp/<slug>/` image paths relative to the source `.md` location, embeds them as data: URIs (with `--max-width 1200` resize), and regenerates the `/paper/` index automatically. Verify `grep -o 'data:image' <slug>-ja.html | wc -l` equals the figure count.

## Step 1 Rule

`clean-original.html` creation is mandatory.

Treat it as:

- the first stable artifact
- the source for later Japanese structuring
- the minimum English reading artifact worth preserving

Do not start by writing `<slug>-ja.md` from raw publisher HTML directly. Always pass through clean-original first so the Japanese version inherits a clean section structure.

## Repository-Specific Convention For life

When working inside the `life` repo:

- **staging area**: `portfolio/paper-close-readings/tmp/<slug>/` (gitignored, one subdir per paper, contains PDFs / raw HTML / figures / `clean-original.html`; bare `tmp/` stays empty between papers)
- **canonical artifacts** (git-tracked, in `portfolio/paper-close-readings/`):
  - `<slug>.md` — lightweight index
  - `<slug>-ja.md` — full Japanese close-reading
- **portal output** (gitignored, auto-rendered to `~/.local/share/life/_life/paper/`):
  - `<slug>.html` — index, served by Caddy at `http://fenrir:8080/paper/<slug>.html`
  - `<slug>-ja.html` — Japanese close-reading with embedded images, served at `http://fenrir:8080/paper/<slug>-ja.html`

The `<slug>.md` index is for:

- title, authors, DOI, journal
- local paths (clean-original.html in `tmp/<slug>/`, ja.md, ja.html)
- Drive / Paperpile links
- one-line summary
- figure roles (1-2 lines)
- strong conclusions
- weaknesses / unresolved points
- critical comments (high-level — full version in `<slug>-ja.md`)
- next reading targets

Do not commit PDFs, raw figure assets, or `clean-original.html` (= all live in `tmp/<slug>/`).

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
python3 <skill-dir>/scripts/make_clean_original.py tmp/<slug>/original.html tmp/<slug>/clean-original.html
# rewrite any remaining publisher figure URLs to local Fig.N.* refs, then embed
python3 scripts/embed_local_images_in_html.py --max-width 1200 tmp/<slug>/clean-original.html
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
![Fig.1: Phylogenetic tree of bilin reductases](tmp/<slug>/Fig.1.png)
```

The image will be inlined as a data: URI when render_all.sh produces the portal HTML — no manual embedding step needed for `<slug>-ja.md`. **Do not put `[` / `]` in the alt text** — square brackets break markdown image parsing and the figure silently fails to embed.

Always:

- distinguish what the data directly show from the authors' model
- mark limitations and uncertainty clearly
- leave critical comments even if the paper is strong

Read `references/ja-html-template.md` for the expected Japanese tone (the template is HTML-flavored but the structure carries over to markdown).

## Visual Style Rule

Use the `daily-search-trend` Newsprint-inspired CSS direction. The Newsprint CSS is automatically applied to portal HTML by `scripts/render_md.py` — no per-document style work needed for `<slug>-ja.html`.

For `tmp/<slug>/clean-original.html` (which is hand-cleaned from publisher HTML), keep restrained paper-like colors, thin rules, and readable serif typography. Avoid app-like card dashboards unless the user explicitly asks for a different visual language.

## Self-Contained Output Rule

The portal HTML produced from `<slug>-ja.md` must have all `tmp/<slug>/Fig.*.png` references embedded as data: URIs. This is handled automatically by `scripts/render_all.sh`'s paper render pass, which:

1. Calls `embed_local_images_in_html.py --base-dir <source-dir> --max-width 1200` (Pillow-backed) so figures resolve from `portfolio/paper-close-readings/tmp/<slug>/` and are downscaled to a 1200px max width (consistent display + ~65% portal size reduction).
2. Calls `scripts/automation/regen_paper_index.py` to rewrite the auto-generated table in `portfolio/paper-close-readings/README.md` between the `<!-- AUTO:LINKS:START -->` / `<!-- AUTO:LINKS:END -->` markers. The new paper appears at `http://fenrir:8080/paper/` (the portal index) automatically.

For `tmp/<slug>/clean-original.html` (English reading copy, not in portal), embed images explicitly:

```bash
python3 scripts/embed_local_images_in_html.py tmp/<slug>/clean-original.html
# Optionally also resize for offline reading on small screens
python3 scripts/embed_local_images_in_html.py --max-width 1200 tmp/<slug>/clean-original.html
```

This makes the clean-original portable for offline reading even though it is not committed.

## Output Checklist

Before finishing, verify:

- `tmp/<slug>/clean-original.html` exists, opens as valid HTML, has embedded `data:image` URIs
- `portfolio/paper-close-readings/<slug>-ja.md` exists with markdown image references like `![Fig.1: ...](tmp/<slug>/Fig.1.png)` and **no `[`/`]` in alt text**
- `portfolio/paper-close-readings/<slug>.md` index references both files (clean-original path under `tmp/<slug>/`)
- bare `tmp/` contains no loose paper assets (everything is under `tmp/<slug>/`)
- `## 批判的コメント` section is present in `<slug>-ja.md`
- After `bash scripts/render_all.sh`:
  - `~/.local/share/life/_life/paper/<slug>.html` and `<slug>-ja.html` exist
  - ja.html contains embedded `data:image` URIs (`grep -c 'data:image' <slug>-ja.html` should equal the figure count)
  - ja.html size is reasonable (low MB range, since `--max-width 1200` is applied)
  - `portfolio/paper-close-readings/README.md` Link 集 has a new row for this paper (auto-generated by `regen_paper_index.py`), and `http://fenrir:8080/paper/` shows it

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

Pass only the canonical markdown files — never the PDF, raw HTML, figure assets, or `clean-original.html` (all live in `tmp/<slug>/`, which is gitignored). The script commits with `-o` so other staged changes are not swept in.
