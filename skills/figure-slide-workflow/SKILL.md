---
name: figure-slide-workflow
description: "Make figures and slides with one fixed default (fonts, sizes, colors, layouts, English by default) and a fixed workflow: analysis, figure parts, build the pptx (and html), check, place. Use when the user asks to make or fix a slide deck, a progress report slide, a figure for a slide or a paper, a heatmap color scale, or to check a pptx against the defaults (スライド作成, 進捗スライド, 図の作成, スライドの規則, テンプレート, lint, ブレない). Not for writing the talk script itself."
metadata:
  short-description: "Default slide/figure rules and the build-check-place workflow"
---

# Figure and slide workflow

One default for every new slide and figure, so that decks do not drift. The values were measured from a finished conference deck and then decided by the user (2026-11). Read `references/spec.md` for the values and `references/workflow.md` for the steps.

## When to use this

- Any new slide deck, progress report, or figure for a slide or a paper, unless the user names a different rule for that deck.
- Checking an existing pptx against the defaults.
- Choosing colors for a figure or a heatmap.

## The defaults in one screen

- **Language**: English slides by default. Japanese only as an exception (the audience is Japanese).
- **Page**: 960 x 540 pt (33.87 x 19.05 cm), Blank layout, left/right margin 1.69 cm, Noto Sans JP. No boxes, cards, or color bands (one exception: the comment box on progress slides).
- **Text roles** (size, weight, color on a light background): heading 27 pt bold #1F2933 centered; subheading 19 pt bold #1F2933; body and text inside figures 15 pt #1F2933; section label 15 pt #6B7280; notes, sources, page numbers 12.5 pt #6B7280. Dark background #16181D with #E5E7EB and #9AA3AF.
- **Colors**: the shared 12 colors are for lines and fills inside figures only, never for slide text. The accent color for text is blue (#0072B2 on light, #60A5FA on dark); reserve accents are vermillion #D55E00 and bluish green #009E73. A project may add its own colors in its own rules file.
- **Figures**: decide the frame size in cm first and draw at that size (never shrink a picture). Text inside is 15 pt (12.5 pt at the smallest), transparent background, png 600 dpi plus transparent pdf. No panel letters on slides. In papers, all figure text is 10 pt (panel letters 18 pt bold).
- **Heatmaps**: sequential (values >= 0) = white, sky blue, blue, indigo. Diverging (centered) = blue, white, vermillion.
- **Progress slides**: all on a white background, with a left/right two-column design. Types: figure + comment box, two figures + comment box, Why (left) / How (right, with a diagram of the principle), table + comment box, To discuss (left) / Next steps (right). The comment box is the accent blue at 30 % opacity, no line, 15 pt text, bullets with a dot for results and an arrow for interpretation. Elements stack from the top; the box sits 0.3 cm below the element above it.
- **Citations**: one line at the bottom of each slide (12.5 pt gray, journal name in italic). No reference slide, no agenda slide, no section dividers.

## Steps

1. **Start from the template**: `assets/slide-template/default_template_*.pptx` in the user's life repo (the source of truth; use the newest version, older ones go to `_old/`). The same version is copied to the user's iCloud Drive (`Documents/2_Areas/slide-template/`) for opening on other devices. Copy the template; never edit it in place. The rules are in `assets/slide-template/slide_default_spec_*.md` there and in `references/spec.md` here.
2. **Make the figure parts first** (analysis, then figures), then place them at actual size.
3. **Check before handing over**: run the lint script (`scripts/slide_lint/slide_lint.py` in the user's life repo; see its README), save and reopen the file in PowerPoint to confirm animations survive (`scripts/ppt_roundtrip_check.sh`), and look at every slide as an image.
4. **Hand over** with the file path and its md5. Only the main session puts files into iCloud (copy without overwriting, compare md5, move the old version to `_old/`, never delete).

## Rules that always apply

- Never delete files: move old versions to `_old/` and write new versions under new names (v02, v03).
- A new version is a new file. Compare it with the previous version and list exactly what changed.
- Do not put unpublished content into a public repository. Keep analysis-specific scripts and text outside git.
- Every check needs a positive control: break something on purpose and confirm the check finds it.
- When the request and the records disagree, follow the records and say what you changed.
- Do not use internal nicknames or unexplained abbreviations in reports.
