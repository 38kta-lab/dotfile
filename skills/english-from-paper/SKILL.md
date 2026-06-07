---
name: english-from-paper
description: "Generate English learning artifacts from a finished paper close-reading (<slug>-ja.md must already exist). Produces vocabulary / collocation / grammar study material, a quiz + answer key, an English-only podcast script, and a NotebookLM Audio Overview customize prompt. Outputs are co-located in portfolio/paper-close-readings/. The 2 NotebookLM input files (clean-original.html + <slug>-en-study.md) plus the prompt.txt are staged to Google Drive's paper-podcasts/<slug>/ for manual upload to NotebookLM (typically via fenrir remote desktop). Use when the user says english-from-paper, 英語学習素材, 論文から英語学習, NotebookLM script, X04 英語, or wants vocab / quiz / podcast assets generated from a finished paper close-reading."
metadata:
  short-description: "精読済み論文 → vocab / quiz / 英語 podcast script + NotebookLM prompt 生成、NotebookLM 投入 file を Drive paper-podcasts/<slug>/ に配置"
---

# English From Paper

## Purpose

Reuse a finished paper close-reading (`<slug>-ja.md`) as the source for 4-modality English study material. One paper → vocab/quiz (reading + writing) → English podcast (listening) → speaking material once 2-3 papers are stocked.

| Modality | Artifact produced here |
|---|---|
| **reading + writing** | `<slug>-en-study.md` (vocab / collocation / grammar), `<slug>-en-quiz.md` + `<slug>-en-quiz-ans.md` |
| **listening** | `<slug>-podcast-script.md` (English-only reference transcript) + NotebookLM-generated m4a (user makes manually) |
| **speaking** | out of scope — user runs Claude voice with 2-3 papers as context |

NotebookLM generates the actual podcast m4a. This skill only prepares the input files + customize prompt for upload.

## Expected Input

The paper close-reading must already exist:

```text
portfolio/paper-close-readings/
  <slug>.md                  ← lightweight index (paper-close-reading skill output)
  <slug>-ja.md               ← Japanese close-reading (paper-close-reading skill output)
  tmp/clean-original.html    ← English cleaned HTML (HTML mode) — required for NotebookLM upload
  tmp/Fig.*.png              ← figure assets
```

If `clean-original.html` is missing (PDF-mode papers), warn the user. Either skip Drive staging or upload the raw PDF to NotebookLM instead.

Read `README.md` and `Rules.md` before any write.

## Outputs

Five new files in `portfolio/paper-close-readings/`:

1. **`<slug>-en-study.md`** — vocab / collocation / grammar / acronyms / speaking phrases
2. **`<slug>-en-quiz.md`** — quiz questions (no answers)
3. **`<slug>-en-quiz-ans.md`** — answer key + 1-line explanations
4. **`<slug>-podcast-script.md`** — English-only reference transcript (~12 min target)
5. **`<slug>-notebooklm-prompt.txt`** — Audio Overview customize prompt (paste into NotebookLM)

The index `<slug>.md` is updated to link to all 5 under a new `## English study` section.

## Output: `<slug>-en-study.md`

```markdown
---
slug: <slug>
type: english-study
created: YYYY-MM-DD
paper_title: <title>
audience: biology researchers (broad)
---

# English Study — <paper title>

## 1. Key Vocabulary (20-30 items)

| Term | Definition (EN) | Example from paper | 日本語 |
|---|---|---|---|
| **thylakoid** | flattened membrane sac where light reactions occur | "...thylakoid membranes are partitioned..." | チラコイド |
| ... | | | |

## 2. Collocations & Phrases (10-15 items)

- **be partitioned among** — to be divided between groups / **〜の間に分配される、分割される**
  - Paper: "Thylakoids are partitioned among daughter cells..."
  - Reuse: "Resources are partitioned among competitors."
  - 解説: `among` は 3 者以上に分ける時、`between` は 2 者の時。"partition into N groups" (N つの群に分割) と "partition among N entities" (N 者の間で分配) の違いに注意。

## 3. Grammar / Sentence Patterns (5-10 examples)

### Pattern: Reduced relative clause (V-ed by ...) / **過去分詞による関係詞節の短縮**
- Paper: "Cells divided by binary fission inherit..."
- Expanded: "Cells that are divided by binary fission inherit..."
- 用法: `the X V-ed by Y` で `the X that is/are V-ed by Y` を短縮 (関係代名詞 + be 動詞 を省略)。
- 解説: 関係代名詞を省いて分詞化することで文を引き締める。Methods / Results / 図のキャプションで多用。日本語の連体修飾 (「Y によって V された X」) と同じ感覚で読める。

## 4. Acronyms

- **FtsZ** — Filamenting temperature-sensitive Z (bacterial tubulin homolog)

## 5. Phrases for Speaking About This Paper

- "The key contribution of this work is..."
- "What I find compelling is that..."
- "One limitation worth flagging is..."
```

Section 5 seeds the speaking-stage practice (used later in Claude voice sessions).

## Output: `<slug>-en-quiz.md` and `<slug>-en-quiz-ans.md`

15-20 questions total, mixed format:

```markdown
---
slug: <slug>
type: english-quiz
question_count: 15-20
---

# English Quiz — <paper title>

## A. Vocabulary cloze (8 questions)

1. The thylakoid membranes are ___ among daughter cells during binary fission. (Hint: divided into groups)

## B. Collocation choice (5 questions)

9. Choose the correct preposition: "The signal gives ___ to a downstream cascade."
   (a) rise (b) raise (c) arose (d) raised

## C. Comprehension (5 questions)

14. What does Figure 1 demonstrate about thylakoid distribution?
```

`-en-quiz-ans.md` mirrors the section structure with answer + 1-line explanation each.

## Output: `<slug>-podcast-script.md`

English-only, ~12 minute target (1200-1800 words), 2 hosts. Reference transcript only — NotebookLM improvises from the prompt + notebook sources.

```markdown
---
slug: <slug>
type: podcast-script
language: English
duration_target: 12 min
purpose: NotebookLM-generated podcast reference transcript
---

# Podcast Script (English) — <paper title>

This is a written reference. Audio is generated by NotebookLM with
`<slug>-notebooklm-prompt.txt` as the customize prompt and notebook
sources being `tmp/clean-original.html` + `<slug>-en-study.md`.

## Segment 1: Introduction (~3 min)

**Host A**: Welcome back. Today's paper is from <Author et al., Year> in <Journal>. ...

**Host B**: ...

## Segment 2: Methods overview (~3 min)
...

## Segment 3: Key findings (~4 min)
...

## Segment 4: Discussion / implications (~2 min)
...
```

## Output: `<slug>-notebooklm-prompt.txt`

Plain text, English (NotebookLM accepts English prompts).

**Note on duration**: NotebookLM treats the "X-minute" instruction as a hint, not a hard constraint. With a content-rich source, expect the actual output to run **1.5–2× the requested duration** (i.e. a "12-minute" request typically lands at 15–25 min). This is acceptable for listening practice — the 12-min framing is kept because removing it gives even longer outputs, and the per-segment time budget (3/3/4/2) still shapes pacing within the longer episode. Confirmed 2026-06-07 with Kobayashi 2014 trial: 12-min request → 18-min `.m4a` output.

```
Generate a 12-minute Audio Overview of this notebook for biology researchers.

[Structure]
- Introduction (3 min): background, the question, why it matters
- Methods overview (3 min): emphasize technique names and experimental design
- Key findings (4 min): cite specific numbers, figure numbers, statistical results
- Discussion / implications (2 min): limitations and future directions

[Language]
- English only, throughout
- Expand abbreviations on first use (full form, then the abbreviation)
- Define discipline-specific jargon briefly when first introduced

[Audience]
- Working biology researchers (broad — not field-specific)
- Academic but conversational tone, natural two-host discussion

[References]
- Cite figures and tables by number (Figure 1, Table 2, etc.)
- Quote specific numerical values from the results section

[Paper]
- Title: <TITLE>
- Authors: <AUTHORS>
- Journal / Year: <JOURNAL>, <YEAR>
- Focus: <FOCUS_HINT — 1-2 concrete sentences on the central question, extracted from abstract>
```

The skill auto-fills `<TITLE>`, `<AUTHORS>`, `<JOURNAL>`, `<YEAR>`, `<FOCUS_HINT>` from the index `<slug>.md` and abstract. **No `<PLACEHOLDER>` left in the final file.**

## Drive Staging

NotebookLM accepts: PDF / Google Doc / Google Slide / `.txt` / Website URL / YouTube URL / audio. It does **not** accept raw `.html` uploads. So the staging produces a `.txt` version of the paper body and copies it alongside the HTML (HTML kept as offline backup, txt is what gets uploaded).

```bash
DRIVE_ROOT="$HOME/Library/CloudStorage/GoogleDrive-38kta.lab@gmail.com/マイドライブ"
DST="$DRIVE_ROOT/paper-podcasts/<slug>"
mkdir -p "$DST"
cp portfolio/paper-close-readings/tmp/clean-original.html         "$DST/"
python3 scripts/papers/html_to_txt.py \
  portfolio/paper-close-readings/tmp/clean-original.html \
  "$DST/clean-original.txt"
cp portfolio/paper-close-readings/<slug>-en-study.md              "$DST/"
cp portfolio/paper-close-readings/<slug>-notebooklm-prompt.txt    "$DST/"
```

Tell the user (in the skill's final report):

- Files staged at `paper-podcasts/<slug>/` in Drive
- On fenrir, open NotebookLM → New notebook → add sources in this priority:
  1. **If the paper is on PMC** (open access): "Add source → Website" with the PMC URL — gives the cleanest text + caption extraction. PMC URL pattern: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMCxxxxxxx/`
  2. **Otherwise**: upload `clean-original.txt` as a text source.
  3. **Always**: upload `<slug>-en-study.md` as an additional source (NotebookLM accepts `.md`).
- Audio Overview → Customize → paste contents of `<slug>-notebooklm-prompt.txt`
- Save the resulting .m4a (NotebookLM exports AAC `.m4a`, not `.mp3`) back to the same Drive folder. Either keep NotebookLM's auto-generated descriptive title (e.g. `Three_Unique_Enzymes_for_the_Protox_Bottleneck.m4a`) or rename to `<slug>-podcast.m4a` — both are picked up by the per-paper folder, and the descriptive title is preserved in the index entry verbatim.
- Once m4a is in place, share the Drive URL so the index can be updated

## Updating the Index

Add a new section to `<slug>.md`:

```markdown
## English study

- 学習テキスト: [<slug>-en-study](./<slug>-en-study.html)
- Quiz: [Q](./<slug>-en-quiz.html) / [A](./<slug>-en-quiz-ans.html)
- Podcast script (EN): [<slug>-podcast-script](./<slug>-podcast-script.html)
- Podcast (m4a): TBD (NotebookLM 投入後に Drive URL を記入)
- NotebookLM prompt: `<slug>-notebooklm-prompt.txt`
```

After m4a is created and Drive URL provided, update the Podcast (m4a) line.

## regen_paper_index.py Filter

`scripts/automation/regen_paper_index.py` currently only skips `*-ja.md` and `README.md` when building the paper list. The new study files would show up as spurious "paper" rows. Patch the SKIP set before running render_all:

```python
SKIP_SUFFIXES = (
    "-ja.md",
    "-en-study.md",
    "-en-quiz.md",
    "-en-quiz-ans.md",
    "-podcast-script.md",
)
# in main():
if md.name == "README.md" or any(md.name.endswith(s) for s in SKIP_SUFFIXES):
    continue
```

This patch must land in the same change set as the first skill run.

## Required Workflow

1. **Read** `<slug>.md` and `<slug>-ja.md`. Confirm the close-reading exists. Capture title / authors / journal / year. Extract a 1-2 sentence central question for `<FOCUS_HINT>`.
2. **Read** `tmp/clean-original.html` (HTML mode) or text-extracted PDF (PDF mode) for the canonical English source.
3. **Generate** the 5 output files in `portfolio/paper-close-readings/`.
4. **Stage** to Drive: `clean-original.html` + `<slug>-en-study.md` + `<slug>-notebooklm-prompt.txt` → `paper-podcasts/<slug>/`.
5. **Update** `<slug>.md` index with the `## English study` section (m4a link as TBD).
6. **Render** to portal: `bash scripts/render_all.sh`. (4 markdown files become HTML; the `.txt` is not rendered.)
7. **Report**: file paths, Drive folder path, NotebookLM upload instructions, and a reminder to send back the m4a Drive URL.

## Quality Bars

`<slug>-en-study.md`:

- 20-30 vocabulary items — include high-utility academic verbs and structural phrases, not just rare jargon
- Each vocab item has: paper example (verbatim), EN definition, reuse example, JA gloss
- **Collocations** entries have: EN meaning + **JA 訳/対応表現**, paper quote, reuse example, **and a 解説 line in Japanese** covering register (formal/informal), preposition choice, near-synonyms, and when to use vs avoid
- **Grammar patterns** entries have: paper quote, expanded form (when reduced), **a 用法 line in Japanese** (the abstract template), and **a 解説 line in Japanese** explaining when/why this pattern is used, the equivalent Japanese expression, and common pitfalls
- Collocations focus on what generalizes to writing other biology papers
- Grammar patterns must be **transferable** (not curiosities)

`<slug>-en-quiz.md`:

- **Fixed total of 20 questions** with section breakdown:
  - **A. Vocabulary cloze** — 8 questions
  - **B. Collocation / preposition choice** — 5 questions
  - **C. Comprehension** — 7 questions (~1–2 sentence answers)
- Frontmatter: `question_count: 20`
- Comprehension questions test the paper's **contribution**, not trivia
- All answers derivable from paper or study material — no external knowledge required
- Numbering is sequential across sections (1-8 in A, 9-13 in B, 14-20 in C)

`<slug>-podcast-script.md`:

- Two distinct hosts (A presents, B asks critically)
- Specific numbers, figure references, and quotes from results
- Limitations explicit in Segment 4

`<slug>-notebooklm-prompt.txt`:

- All `<PLACEHOLDER>` fields filled in
- `<FOCUS_HINT>` is 1-2 concrete sentences (not "this paper studies X")

## What This Skill Does NOT Do

- Does NOT run NotebookLM — user does that manually on fenrir
- Does NOT generate the m4a audio
- Does NOT run Claude voice / speaking practice — separate session on user's side
- Does NOT update the `Podcast (m4a)` link with a Drive URL automatically — requires user to provide the URL after NotebookLM finishes
- Does NOT create new paper close-readings — `<slug>-ja.md` must already exist

## Repository-Specific Convention For life

- Outputs live in `portfolio/paper-close-readings/` (co-located with paper-close-reading artifacts)
- Drive staging path: `~/Library/CloudStorage/GoogleDrive-38kta.lab@gmail.com/マイドライブ/paper-podcasts/<slug>/`
- Per-paper Drive folder collects: NotebookLM inputs (HTML + study + prompt) and the eventual m4a
- Audience for podcast prompt: **biology researchers (broad)** — wider than user's plant physiology focus so NotebookLM doesn't drift into one subfield

## Auto-finalize

After producing the 5 files, run the shared finalize script:

```bash
bash scripts/agent_auto_finalize.sh \
  -m "docs: 📚 english-from-paper: <paper short title>" \
  portfolio/paper-close-readings/<slug>-en-study.md \
  portfolio/paper-close-readings/<slug>-en-quiz.md \
  portfolio/paper-close-readings/<slug>-en-quiz-ans.md \
  portfolio/paper-close-readings/<slug>-podcast-script.md \
  portfolio/paper-close-readings/<slug>-notebooklm-prompt.txt \
  portfolio/paper-close-readings/<slug>.md
```

`AGENT_AUTO_COMMIT=1` on fenrir auto-commits; on Air the call is a no-op.
