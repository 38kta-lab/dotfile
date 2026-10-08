---
name: morning-tasks
description: "Load the auto-generated morning brief (ideas/task-review/md/morning-YYYY-MM-DD.md) into the shared task list ideas/task-review/tasks.md, so every session can see today's tasks and they survive /clear. Runs in the ops session only. Use when the user says morning-tasks, /morning-tasks, ブリーフを取り込んで, 今日のタスクをTaskにして, brief から task 作って, load brief, ingest morning brief, or wants the morning brief turned into today's task list."
metadata:
  short-description: "Write today's tasks from the morning brief into tasks.md"
---

# Morning Tasks

Read the already-generated morning brief and write the items under "今日やるべきこと" into `ideas/task-review/tasks.md`, the task list shared by every session.

Until 2026-10-08 this skill loaded the brief into the session's TaskCreate list. That list lived only in one session and vanished on `/clear`, and the brief could not see it, so finished items came back the next morning. `tasks.md` replaces it. See `Rules.md`「記録の 3 層と tasks.md」.

This skill does NOT regenerate the brief — that is handled by the fenrir LaunchDaemon `com.kta.morning-brief` at 06:15 JST. If the brief is missing for today, stop and tell the user.

## Repository Rules

Before reading anything:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety rules and the tasks.md rules.
3. Use `rg` first when searching notes.

This skill is intended for the `life` repo. If invoked elsewhere, stop and report.

**Run it in the ops session only.** Check `echo $LIFE_ROLE` first. If it is not `ops`, stop and tell the user: only the ops session writes `tasks.md` (the config-guard mod refuses the write from any other session, so do not try another way).

## Inputs

```text
ideas/task-review/md/morning-YYYY-MM-DD.md   today's brief (cron)
ideas/task-review/tasks.md                   the shared task list
```

Use the local execution date for `YYYY-MM-DD`. Always call `date +%F` once before reading so the date is correct.

If today's brief does not exist:

- Report the missing path.
- Suggest running the brief manually (`bash scripts/automation/run_morning_brief.sh` on fenrir) or invoking `/task-review` to plan from scratch.
- Do NOT fall back to yesterday's brief.

## tasks.md shape

```markdown
## 今日 YYYY-MM-DD

- ⬜ [PJ] やること — @担当 — 起票日（締切）

## 今週・近日

## 待ち
```

- One task per line. `[PJ]` is the hub slug prefix (`[03_C]`, `[M20]`) or `[事務]` for admin.
- Owner is `@user`, `@ops`, or `@claude-<slug>` for a peer session.
- `⬜` open, `✅` done. Keep the hub checkbox style (`- ⬜` / `- ✅`).

## Workflow

1. Run `date +%F` and `echo $LIFE_ROLE`. Stop unless it is `ops`.
2. Read today's brief and `tasks.md`.
3. **Clear yesterday's done lines.** Delete every `✅` line (their history is in the hub or the research repo's `note/progress.md`). Rename the `## 今日 <old date>` heading to today; move its remaining `⬜` lines there as carry-over.
4. Extract the numbered items under `## 今日やるべきこと` in the brief. One numbered item = one line, even when it has sub-bullets.
5. **Skip what tasks.md already has.** If an open line already covers the item, keep the existing line (its owner and start date) instead of adding a duplicate.
6. Add the rest under `## 今日 YYYY-MM-DD`, in brief order, as `- ⬜ [PJ] <subject> — @担当 — <today>（<deadline if the brief gives one>）`.
   - Subject: the bolded title, trimmed. Keep the brief's noun phrase; do not rephrase aggressively.
   - Owner: `@user` unless the brief or the hub names a session.
7. Edit line by line with the Edit tool. Never rewrite the whole file.
8. Report (see Reporting).

## Reporting

```text
Loaded ideas/task-review/md/morning-2026-10-08.md → tasks.md
  cleared 3 done lines from 10/07
  carried over 4 open lines
  added 2:
    ⬜ [事務] 系会議の議題連絡（15:00 〆）
    ⬜ [M20] 現状確認＋実作業
```

## During the day

As the user works, keep `tasks.md` true. These cases recur:

### 1. Done

Mark the line `✅`. **In the same turn, update that PJ hub's Next Actions** (Rules.md).

### 2. Submitted, awaiting an external event

Example: the brief lists "出張申請の状態確認" and the user replies "申請は提出済み、出張後に報告書を出す".

- Rewrite the line to the remaining action and its trigger, and move it to `## 待ち`.
- Do not split it into a done line and a new line.

### 3. Handled in another session

Set the owner to that session (`@claude-03`). Do not delete the line — that is what makes it visible to every session.

### 4. Email-driven item resolved by triage (該当なし / 提出済み / 担当外)

- Mark the line `✅`, AND tag the Gmail messages with `9. Done/Triage` so tomorrow's brief and `gmail_triage` exclude them.
- Tag command pattern:
  ```bash
  conda activate life && python scripts/gmail_label.py \
    --query 'subject:"<unique substring>"' \
    --add-label "9. Done/Triage" --max-results 5 --dry-run
  ```
  Always dry-run first to confirm the query matches only the intended messages. Use unique substrings like `sysbunka 04165` rather than broad keywords. Then rerun without `--dry-run` and confirm each message carries the label.
- Why: marking the line done without tagging the email brings the item back in tomorrow's brief.

### 5. Already on Calendar

Mark the line `✅`. Calendar read: `python scripts/google_calendar_read.py --start YYYY-MM-DD --end YYYY-MM-DD+1`.

## What This Skill Does NOT Do

- Does NOT regenerate or edit the brief.
- Does NOT create GitHub Issues — use `issue-capture`.
- Does NOT copy hub Next Actions wholesale into tasks.md. Only what starts today or this week goes there.
- Does NOT use TaskCreate.

## Safety

Writes only `ideas/task-review/tasks.md`. Does not commit or push unless the user asks.

Do not auto-run on session start — it is explicitly user-triggered.
