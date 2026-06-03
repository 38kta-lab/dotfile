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

## What This Skill Does NOT Do

- Does NOT regenerate the brief — that is cron-driven.
- Does NOT modify the brief Markdown file.
- Does NOT create GitHub Issues — use `issue-capture` for that.
- Does NOT persist TaskCreate entries across sessions — they live only for the current session. If you want durable tracking, write the residue back to the brief Markdown / Issue / `projects/active/*.md` before `/clear`.
- Does NOT touch the Gmail / Calendar / memo sections of the brief.

## Safety

This skill only reads the brief and writes to in-session task state. It does not commit, push, or write files.

Do not auto-run this skill on session start — it is explicitly user-triggered. The user invokes it when they want the brief surfaced as trackable tasks for the work session ahead.
