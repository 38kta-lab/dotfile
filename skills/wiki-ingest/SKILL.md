---
name: wiki-ingest
description: "Ingest new dated entries from the user's 「2026年 セミナー・学会・MTG Wiki」 Google Doc into the life repo as accumulated knowledge, then write a research-direction digest of only the newly-added sections. Syncs the Doc to the canonical ideas/wiki/2026_wiki.md mirror, uses git diff to detect increments, and produces ideas/wiki/digests/YYYY-MM-DD-wiki-digest.md connecting new seminar/MTG knowledge to the user's active projects. Use when the user says wiki-ingest, /wiki-ingest, wiki取り込んで, wiki を取り込む, セミナーメモ取り込み, wiki digest, ingest wiki, または週次で Wiki の新規分を life に取り込みたいとき."
metadata:
  short-description: "Wiki(Doc) の新規日付分を 2026_wiki.md に増分取り込みし、研究方針 digest を生成"
---

# Wiki Ingest

The user keeps 「2026年 セミナー・学会・MTG Wiki」 as a Google Doc — accumulated
seminar Q&A, MTG discussion logs, reading notes, organized by date-coded headers
(YYMMDD). This skill pulls that knowledge into the life repo and distills the
**newly-added** entries into a research-direction digest.

Purpose is **knowledge accumulation + research direction**, NOT scheduling. Do
not treat the Wiki as a calendar.

## Repository Rules

This skill targets the `life` repo. If invoked elsewhere, stop and report.

1. Read `README.md` for directory policy, `Rules.md` for safety rules.
2. Use `rg` first when searching notes.
3. Write user-facing Markdown in Japanese.

## Data flow

```
Google Doc (Wiki, 編集面 = SSoT)
   │  scripts/wiki/sync_wiki.py  (readonly Drive token)
   ▼
ideas/wiki/2026_wiki.md    canonical, date-sorted mirror (git-tracked)
   │  git diff vs HEAD  →  newly-added date sections
   ▼
ideas/wiki/digests/YYYY-MM-DD-wiki-digest.md   research-direction digest of NEW only
```

Incremental unit = git. After a successful digest, the updated `2026_wiki.md`
and the new digest are committed, so the NEXT run's `git diff` shows only what
changed since this run. No separate state file.

## Workflow

1. **Date**: run `date +%F` once (see global memory `feedback_check_current_time_first`).

2. **Sync** the Doc to the canonical mirror:
   ```bash
   conda activate life && python scripts/wiki/sync_wiki.py
   ```
   The script rewrites `ideas/wiki/2026_wiki.md` and prints to stderr a
   `new since HEAD: N section(s)` list with `+ <key>` lines.

3. **Detect new sections**. Prefer the script's stderr report. Cross-check with:
   ```bash
   git diff --unified=0 -- ideas/wiki/2026_wiki.md | rg '^\+## '
   ```
   Each new section is headed `## YYYY-MM-DD [category] title` in the mirror.

4. **If there are NO new sections**: do NOT write an empty digest. Report
   「新規の日付エントリなし」 and stop (still leave the re-synced mirror; its diff,
   if any, is only the `synced:` timestamp — you may `git checkout` it to avoid
   a noise commit, or leave it).

5. **If there are new sections**: read their full text from `ideas/wiki/2026_wiki.md`
   (only the new ones — use the keys from step 3). For deeper context you MAY read
   nearby existing sections, but the digest covers the NEW entries.

6. **Write the digest** to `ideas/wiki/digests/<today>-wiki-digest.md` using the
   template below. Focus on research direction and knowledge, and connect entries
   to the user's active projects (`projects/active/*.md`) — especially the PJ tags
   that appear in the notes (e.g. `07_G`, `11_K`, `12_L`, A系/学術変革). Grep
   `projects/active/` if you need a hub's current state to make the connection.

7. **Commit** the mirror + digest so the baseline advances:
   - In cron context (`AGENT_AUTO_COMMIT=1` in env): run
     ```bash
     bash scripts/agent_auto_finalize.sh -m "docs(wiki): <today> 新規分取り込み + digest" \
       ideas/wiki/2026_wiki.md ideas/wiki/digests/<today>-wiki-digest.md
     ```
   - In interactive context: stage those two paths and commit (do NOT sweep
     unrelated changes). Ask the user before `git push` unless they already said to.

8. **Report** (see Reporting).

## Digest template

```markdown
# Wiki 取り込み digest — <today>

> 対象: ideas/wiki/2026_wiki.md の新規 N セクション（<日付範囲>）
> 注記: 【示唆】はメモからの解釈・推測を含む。一次情報は該当日付セクション参照。

## 1. 研究方針への示唆（PJ 別）
（新規メモが関係する PJ ごとに。07_G / 11_K / 12_L / A系 等。該当 hub 名も。
 各項に【示唆】= 自分の研究への具体的な次アクション/論点。）

## 2. 知識の要点（テーマ別）
（分野横断で、新規メモの知識ポイントを簡潔に。文献リンクは残す。）

## 3. 再利用可能な参照知識（あれば）
（primer 的にまとまっているメモ = 後で参照したい知識。）

## 4. フォローアップ候補
（- [ ] チェックボックス形式。今日/今週の具体アクション。）
```

Keep it tight — this digest is meant to be read in a few minutes, not to
re-transcribe the notes (the notes live in `2026_wiki.md`).

## Reporting

Report compactly in Japanese:
- 同期したセクション数 / 新規セクション数
- 新規があれば digest path と、研究方針の最重要ポイント 1–2 行
- コミットしたか（cron / interactive）

## What this skill does NOT do

- Does NOT edit the Google Doc (readonly). Editing happens on the Doc side.
- Does NOT create GitHub Issues (use `issue-capture`) or write to PJ hubs
  automatically (只 digest で示唆を出す。hub 反映は人が判断)。
- Does NOT feed the morning/night brief (that scheduling integration was
  intentionally removed — Wiki is for knowledge, not calendar).

## Safety

Read-only against Drive. Commits only the two explicit paths. On non-fenrir
hosts `agent_auto_finalize.sh` refuses unless on `work/<host>`; interactively,
default to committing on the current branch only if it is the repo's normal
working branch, else ask.
