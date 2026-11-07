# Workflow: analysis, figure parts, deck, check, place

| Step | Who | In | Out |
|---|---|---|---|
| 1 Analysis | analysis session | data, question | tables under the analysis number's out/ folder |
| 2 Figure parts | figure session | tables | png (600 dpi, transparent), pdf (transparent), svg if needed, at the frame size in cm |
| 3 Build | slide session | template, figure parts, script | pptx (and html if needed) as a new version file |
| 4 Check | slide session | the new pptx | lint table, save-and-reopen result, image review, comparison with the previous version |
| 5 Place | main session | pptx + md5 | iCloud folder (copy without overwriting, md5, old version to `_old/`) |
| 6 Record | main session | | the task list, the project hub, a short note |

## Hand-over between steps
- Say the path, the size in cm, and the md5. Do not hand over by "I put it somewhere".
- A request that changes a size is decided once and sent once.
- When the user edits a pptx by hand, build the next version from the user's latest file, and list every difference from the previous version.

## Checks (each with a positive control)
- Lint: `slide_lint.py <pptx>` (sizes, weights, fonts, text colors, role positions, English only, picture scaling, comment box, shapes outside the page; with a pdf: overflow and line overlap). Figure colors are not checked.
- Save and reopen in PowerPoint and compare the animation counts (`ppt_roundtrip_check.sh`).
- Compare with the previous version shape by shape; list the differences.
- Look at every slide as an image.
- Positive control: change something on purpose (for example a heading to 26 pt) in a copy and confirm the checks report it.

## Pitfalls
- Removing a shape with python-pptx can leave animation targets pointing nowhere, and PowerPoint then asks to repair the file. Check that every target exists before saving.
- Adding slides can misorder the part names; rename parts in order before saving.
- New slides have no notes frame; copy it from another slide.
- Italic Noto Sans JP can render thin in some PowerPoint installs. Check with a copy whose italic runs use another family, and leave the deliverable untouched.
- PowerPoint's PDF export downsamples images to 300 dpi; judge resolution from the file, not from the PDF.
- Text boxes that auto-grow store a stale height; compute the bottom edge from the paragraph count.
- Many small files in iCloud (an html folder of hundreds of files) stall the sync. Replace only changed files, or send one zip.
- Do not wait for a process with a `pgrep` loop that matches your own command line.
