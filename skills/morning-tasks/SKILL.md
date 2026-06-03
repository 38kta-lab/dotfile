---
name: morning-tasks
description: "Load the auto-generated morning brief (ideas/task-review/md/morning-YYYY-MM-DD.md) into the current session's TaskCreate list so the user can work through today's tasks with progress tracking. Use when the user says morning-tasks, /morning-tasks, ブリーフを取り込んで, 今日のタスクをTaskにして, brief から task 作って, load brief, ingest morning brief, or wants the morning brief surfaced as trackable TaskCreate entries for this session."
metadata:
  short-description: "Load morning brief into session TaskCreate"
---

# Morning Tasks

Read the already-generated morning brief and create TaskCreate entries for the items listed under "今日やるべきこと" so progress can be tracked within the current Claude Code session.

This skill does NOT regenerate the brief — that is handled by the fenrir LaunchDaemon `com.kta.morning-brief` at 06:15 JST. If the brief is missing for today, stop and tell the user.

## Repository Rules

Before reading anything:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety rules.
3. Use `rg` first when searching notes.

This skill is intended for the `life` repo. If invoked elsewhere, stop and report.

## Inputs

The fenrir cron writes today's brief to:

```text
ideas/task-review/md/morning-YYYY-MM-DD.md
```

Use the local execution date for `YYYY-MM-DD`. Always call `date +%F` once before reading so the date is correct (see the global memory `feedback_check_current_time_first.md`).

If the file for today does not exist:

- Report the missing path.
- Suggest the user run the brief manually (`bash scripts/automation/run_morning_brief.sh` on fenrir) or invoke `/task-review` to plan from scratch.
- Do NOT fall back to yesterday's brief.

## Parsing

The brief has a `## 今日やるべきこと` section with numbered items shaped like:

```markdown
1. **<subject>**
   - 理由: ...
   - 所要時間: ...
   - 推奨時間: ...
```

Some items have additional sub-bullets (e.g. multiple concrete sub-tasks bundled under one number). Always treat the top-level numbered item as one task, even when sub-bullets exist. Do NOT split sub-bullets into separate TaskCreate entries — fold them into the description instead.

Skip the other sections (`## Calendar`, `## Gmail要対応`, `## メモ`, etc.) — they are reference material, not actionable items for the session.

## TaskCreate Mapping

For each numbered item under `## 今日やるべきこと`:

- **subject**: the bolded title of the numbered item, trimmed and in imperative form.
  - If the brief uses a noun phrase (e.g. "本日 6/3 締切の事務メール 3 件"), keep it as-is — do NOT rephrase aggressively.
  - Strip the leading number, period, and `**` markers.
- **description**: the sub-bullets joined as short lines. Preserve `理由:`, `所要時間:`, `推奨時間:`, and any nested bullets verbatim. This is what the user (and Claude in future turns) will read to understand the task.
- **activeForm**: present-continuous form derived from the subject when natural. Omit if the subject reads fine as a spinner label.

Create tasks in the order they appear in the brief. Do NOT add `addBlockedBy` dependencies unless the brief explicitly says one item must finish before another (it usually does not).

## Workflow

1. Run `date +%F` to get today's date.
2. Read `ideas/task-review/md/morning-YYYY-MM-DD.md`.
3. Locate `## 今日やるべきこと` and extract the numbered items.
4. Optionally call `TaskList` first to check whether tasks already exist from an earlier invocation today. If non-trivial duplicates would result, ask the user whether to clear existing tasks (`TaskUpdate status=deleted`) or to skip ingestion.
5. Create one `TaskCreate` per numbered item.
6. Report the result (see Reporting).

## Reporting

After creating tasks, report compactly:

- the brief path that was read
- the number of tasks created
- a one-line summary per task (subject only — do not echo the full description)
- a reminder that `/task-list` (or asking "今のタスクは") will show them

Example:

```text
Loaded ideas/task-review/md/morning-2026-06-03.md → 5 tasks
  1. 本日 6/3 締切の事務メール 3 件を片付ける
  2. 明日 6/4 の微生物 CS 定例会・全体会の出席・準備確認
  3. 6/5 大阪出張まわりの状態確認
  4. メイン作業ブロック: portal-local 次フェーズ or server-setup MTG 準備
  5. 6/5〆タスクを前倒し
TaskList で進捗確認できます。
```

## Pending / In-flight Task Patterns

As the user works through the day, tasks rarely move cleanly from `pending` → `completed`. Handle these recurring cases:

### 1. Task already submitted, awaiting external event

Example: the brief lists "6/5 出張申請の状態確認" but the user replies "申請は提出済み、出張後に報告書を出す". The status-check action is effectively done, but a follow-up step exists after the trip.

- **Do**: keep status as `pending`, update `subject` and `description` to reflect the remaining action and trigger (e.g. "出張完了後に報告書を経理へ提出" / "本日 action 不要、出張後に再浮上させる pending").
- **Do not**: split into two tasks (one completed, one new) — the brief was already one item and the session-scoped task list does not benefit from extra granularity.

### 2. Task being worked on in another Claude session

Example: the user says "#4 は別セッションで進行中".

- **Do**: `TaskUpdate status=deleted` in this session.
- **Why**: TaskCreate is session-scoped and does not sync across sessions. Keeping the task here creates a stale duplicate that the other session cannot update.
- **Do not**: leave it as `pending` / mark as `in_progress` — both mislead later turns in this session into thinking work is owed here.

### 3. Email-driven task resolved by triage (該当なし / 提出済み)

Example: the brief lists "6/3〆 事務メール 3 件" but on review the user finds none of them require a reply (該当条件外 / 希望なし / 既提出).

- **Do**: `TaskUpdate status=completed`, AND tag the relevant Gmail messages with `9. Done/Triage` so the next morning's brief and `gmail_triage` exclude them.
- **Tag command pattern**:
  ```bash
  conda activate life && python scripts/gmail_label.py \
    --query 'subject:"<unique substring>"' \
    --add-label "9. Done/Triage" --max-results 5 --dry-run
  ```
  Always dry-run first to confirm the query matches only the intended message(s). Use unique substrings like `sysbunka 04165` / `syslocal 02296` rather than broad keywords like "勤務状況等申告書" (which match months of history).
- **Why**: marking the task done without tagging the email causes the same item to reappear in tomorrow's brief, recreating the task next time `morning-tasks` runs.

### 4. Brief item already on Calendar

Example: the brief asks to confirm a future event; checking Calendar shows it is already registered with the correct time.

- **Do**: `TaskUpdate status=completed`. No new task needed unless a conflict surfaced.
- **Calendar read**: `python scripts/google_calendar_read.py --start YYYY-MM-DD --end YYYY-MM-DD+1`.

## What This Skill Does NOT Do

- Does NOT regenerate the brief — that is cron-driven.
- Does NOT modify the brief Markdown file.
- Does NOT create GitHub Issues — use `issue-capture` for that.
- Does NOT persist TaskCreate entries across sessions — they live only for the current session. If you want durable tracking, write the residue back to the brief Markdown / Issue / `projects/active/*.md` before `/clear`.
- Does NOT touch the Gmail / Calendar / memo sections of the brief.

## Safety

This skill only reads the brief and writes to in-session task state. It does not commit, push, or write files.

Do not auto-run this skill on session start — it is explicitly user-triggered. The user invokes it when they want the brief surfaced as trackable tasks for the work session ahead.
