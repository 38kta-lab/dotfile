---
name: task-review
description: "Review and plan Japanese tasks for today, tomorrow, this week, next week, or a specified period by combining Google Calendar, ideas/inbox notes, projects/active hubs, agent-memory, and optionally GitHub Issues. Use when the user asks 今日のタスクは, 明日のタスクは, 来週のタスクは, 今週やること, タスク整理, 予定を組んで, Calendarに入れる候補, or wants actionable task priorities and calendar block suggestions."
metadata:
  short-description: "Plan tasks from Calendar, inbox, projects, and memory"
---

# Task Review

Plan actionable tasks by combining Calendar constraints, inbox notes, Project Hubs, working memory, and optionally GitHub Issues.

## Repository Rules

Before reading or writing output:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety, storage, and Issue/Project policy.
3. Use `rg` first when searching notes and memories.

For the `life` repo, the main inputs are:

```text
ideas/inbox/YYYY-MM-DD.md
projects/active/*.md
.agent/memories/*.md
scripts/google_calendar_read.py
scripts/google_calendar_create.py
scripts/gmail_task_review.py
~/.local/share/life/_life/gmail/latest.json
```

Write user-facing summaries in Japanese unless the user asks otherwise.

## When To Use

Use this skill for:

- `今日のタスクは？`
- `明日のタスクは？`
- `来週のタスクは？`
- `今週やることを整理して`
- `予定を組んで`
- `Calendarに入れる候補を出して`
- task planning that should account for Calendar events and active projects

Do not use this skill for pure weekly reflection. Use `weekly-review` when the user asks for a weekly retrospective from digest/memory sources.

## Review Window

Resolve the requested period from the user's wording:

| Request | Window |
|---|---|
| 今日 | local today 00:00 to tomorrow 00:00 |
| 明日 | local tomorrow 00:00 to following day 00:00 |
| 今週 | local today through Friday, unless user specifies otherwise |
| 来週 | next Monday through next Sunday |
| explicit date/range | use the specified date/range |

Use local timezone `Asia/Tokyo` unless the repo or user says otherwise.
Always state the resolved date range in the response.

## Calendar Input

If `scripts/google_calendar_read.py` exists, read Calendar for the review window:

```bash
source ~/miniforge3/etc/profile.d/conda.sh && conda activate life
python scripts/google_calendar_read.py --format json --start YYYY-MM-DDT00:00:00 --end YYYY-MM-DDT00:00:00
```

Run via the repo's conda env (the `life` environment in this repo). **Always source conda.sh before `conda activate`** — bare `conda activate` silently fails when the shell hasn't loaded conda's shell function (typical when Claude Code's Bash tool spawns a non-login shell). The next `python` call would then resolve to `command not found` and the calendar read returns nothing, which looks like "Calendar is empty" but is actually a tool failure. Do not hardcode host-specific Python paths such as `~/miniforge3/envs/life/bin/python` — the conda install location varies per machine. If activation fails, locate the env's Python with `conda env list` or `which python` after activation, and report the issue rather than substituting an absolute path silently.

In the `life` repo, Calendar reads should by default cover both:

- `TimeBlock`
- `primary`

Use `--calendar-id` only when the user explicitly wants to limit or switch the target calendars.

Default Calendar reads must not include location, attendee, or URL details. Do not pass `--show-location` unless the user explicitly asks.

If Calendar read fails because auth is missing, continue using repo notes and report that Calendar was unavailable.

## Note Inputs

Read only the relevant files.

Inbox:

```bash
find ideas/inbox -type f -name '*.md' | sort
```

For today/tomorrow, read today's inbox and the previous 3-7 days if needed for unresolved deadline items.
For next week, scan recent inbox plus items that mention upcoming weekdays or deadlines.

Projects:

```bash
rg "^(summary|created|updated|status|tags|related|nas_repo):|^## (Meetings / Checkpoints|Tasks|Blockers|Next Actions)|^- \\[[ x]\\]" projects/active -n
```

Read project files only when the summary, checkpoint, task, or next action looks relevant to the review window.

**PJ hub の解釈ルール (life#76 後の重要)**:

- Tasks 節の `- [x]` checkbox は **完了済** として扱い、今日の候補から除外する。
- `- [ ]` checkbox のうち、KM ID (例 `KM_N0005`) や explicit な締切が後のものを優先候補にする。「最後に `[x]` がついた KM ID + 1」が直近 WIP の良い目安。
- Milestones / schedule の date table (例 `| 2026-05-17 (土) | KM_N0001: ... |`) は **aspirational schedule (執筆時の予定)** として扱う。そこに書かれた日付が今日と一致しても、対応する `- [ ]` checkbox の状態を必ず照合してから採用する。
  - table 上 "5/17 = KM_N0001" でも、Tasks 節で `KM_N0004 [x]` 済 + `KM_N0005 [ ]` 進行中なら、**checkbox 状態を優先**、table は履歴として扱う。
- frontmatter `updated:` が今日から 5 日以上前なら、出力に `⚠️ PJ hub stale (last updated YYYY-MM-DD)` を併記する。stale hub の milestone schedule は特に信用しない。

**Meetings / Checkpoints の扱い (2026-06-04 追加)**:

各 active PJ hub の `## Meetings / Checkpoints` テーブルを毎回スキャンし、確定した予定 (= `(TBD)` でも `TBD` でもない date) のうち **今日〜+14 日** に該当するものを抽出する:

```bash
rg "^\|\s*\d{4}-\d{2}-\d{2}" projects/active/*.md
```

- 抽出した予定は brief の `## Calendar` セクション直下に「PJ MTG / Checkpoint (Calendar 未登録の可能性)」として併記する。Google Calendar と重複していれば 1 つに統合。
- **prep があるとき**: MTG 行の Prep 列に `#NN` がある場合、その Issue を当該 MTG の prep deadline (MTG 前日) と紐付けて `## 今日やるべきこと` に上げる。
- **Deadline-Bound 節の date 言及** (`- [ ] YYYY-MM-DD ...` 形式 or 本文の `2026-06-08 (月)` 形式) も同様に抽出して deadline-driven task として扱う。

例: tsukatani hub の `| 2026-06-08 (月) 13:00 | MTG | ... | 三宅側の方法論 1-pager (#93) + ... |` 行があれば、brief で:
- 6/8 当日: `## Calendar` 直下に「13:00 学変 A MTG (塚谷 ⇄ 三宅)」
- 6/4-6/7 (prep 期間): `## 今日やるべきこと` に「6/8 MTG prep: #93/#94/#95 を草稿 v1 で塚谷さんへ事前共有」

pj_activity.json 側に `upcoming_checkpoints` / `upcoming_deadlines` フィールドがあれば優先利用 (`scripts/automation/pj_activity_feed.py` で生成、2026-06-04 拡張)。

**PJ activity feed (案 3、実装後)**:

- `/Users/kta/.local/share/life/_life/task-review/pj_activity.json` が存在すれば必ず読む。生成元は `scripts/automation/pj_activity_feed.py`、各 active PJ について git log 最新 commit / NAS repo の直近変更 / agent-memory tag match を集約。
- pj_activity.json と PJ hub MD が矛盾する場合、**pj_activity.json (= 実際の活動証拠) を優先**する。hub MD は意図、activity feed は実態。

Memory:

```bash
rg "^(summary|created|updated|status|tags):" .agent/memories -n
```

Read only memories with recent or explicitly relevant task-planning context, such as "tomorrow", "next action", "Calendar", or "weekly-review".

PJ Activity Feed (案 3 / life#81 で実装、`/Users/kta/.local/share/life/_life/task-review/pj_activity.json`):

```bash
cat /Users/kta/.local/share/life/_life/task-review/pj_activity.json
```

`scripts/automation/pj_activity_feed.py` で生成 (30 分周期、bulk-render と同時)。各 active PJ について `hub_md.stale_days`、`nas_code` / `nas_data` の `recent_changes` top 5、`inferred_last_done`、`inferred_wip` を含む。

- `inferred_wip` を直近 WIP の候補にする (hub MD の `[ ]` 中の最大 KM ID 推定だが、NAS で活動があれば NAS 側を優先)
- `inferred_last_done` 以降の `[ ]` から「今日のタスク」を選ぶ
- `stale_days >= 5` の hub は出力で `⚠️ PJ hub stale` 併記
- ファイル不在の場合は無視して進めて、出力に `(pj_activity.json absent)` を一言入れる

## Known Judgment Errors

最終出力 (今日/明日のタスク / Gmail 要対応 / Calendar 候補 等) を組み立てる**前に**、過去の判断ミス registry を grep して、Status が `open` のエントリと **同じ Category の誤判定を繰り返さない**よう確認する:

```bash
rg "^\| [0-9-]+ \| (morning-brief|task-review) \|" outputs/skill-improvements/judgment-errors.md | rg "\| open \|"
```

主要な `open` Category (2026-05-17 時点):

- **archived-pj-action**: `projects/archive/` 配下 PJ や `status: done` hub に対する action 提案を出さない。Gmail で関連する subject が出ても、archive 化済みの PJ なら action_required から外す。
- **self-sent-misread**: From が user 自身のメール (`USER_EMAIL` 一致) を upcoming task と解釈しない。状態追跡 (返信待ち / 提出済) と捉えて action_required に入れない。

新しい判断ミスを user から訂正された場合は、その場で `outputs/skill-improvements/judgment-errors.md` に 1 行 append する (Date / Skill / Category / Bad / Correction / Root Cause / Status=open)。

GitHub Issues:

- **Default**: always read open Issues + their Project Status at the start of every task-review / morning-brief run (2026-06-04 改訂)。
  ```bash
  gh issue list --repo 38kta-lab/life --state open --limit 100 \
    --json number,title,projectItems \
    --jq '.[] | "#\(.number) | \(.projectItems | map(.status.name // "no-status") | join(",")) | \(.title)"'
  ```
- Surface Issues with Project Status `In progress` near the top of `## 今日やるべきこと` (= currently being worked on).
- Surface Issues whose **title / body / latest comment** references dates within the review window:
  ```bash
  # Per Issue date scan (only for top ~10 candidate issues with dates in title or PJ-hub linkage):
  gh issue view <NN> --repo 38kta-lab/life --json title,body,comments \
    --jq '.title, .body, .comments[].body' | rg "\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}"
  ```
  Use this only on Issues that look likely to have a date (titles containing 提出, 締切, MTG, deadline, or linked from a PJ hub Meetings/Deadline-Bound section).
- When listing today's tasks, reference the relevant Issue by `#NN` so the brief integrates with Project Board.
- Follow `Rules.md` status limits and `issue-capture` policy.
- Do not create or update Issues from this skill unless the user explicitly asks.

Gmail triage:

- If `~/.local/share/life/_life/gmail/latest.json` exists, treat it as an optional external input.
- If `scripts/gmail_task_review.py` exists, prefer using it to derive `Gmail要対応 / Gmail要確認`.
- Read only the structured output. Do not rely on raw Gmail bodies here.
- Use `action_required` as task candidates.
- Use `review_queue` only for category-level counts such as `締切・依頼系: 12件`.
- If `latest.json` is missing or stale, continue without Gmail and say so briefly.

## Planning Rules

- Treat Calendar events as fixed constraints.
- Use Calendar titles as available task context. Do not save or expose location, attendee, or URL data by default.
- When both `TimeBlock` and `primary` are read, merge them as the fixed schedule view for planning.
- Prioritize tasks with explicit deadlines, meetings, presentations, reports, or committed follow-ups.
- When deciding "today's task" for a PJ, follow the PJ hub 解釈ルール above (checkbox 優先、date table は履歴扱い、5 日以上 stale なら警告)。pj_activity.json があれば最優先。
- For today/tomorrow, keep the output executable: 3-6 main tasks is usually enough.
- For next week, make a rough day-by-day plan rather than a dense minute-by-minute schedule.
- Do not overfill the day. Leave buffers around meetings and long fixed events.
- Clearly mark uncertain items as candidates.
- If Gmail triage exists, summarize Gmail-derived tasks in short action language. Do not paste snippets or email bodies.
- Prefer no more than 3 Gmail-derived tasks in the main task list unless the user explicitly asks for a fuller mail review.
- If an item should become an Issue, list it as an Issue candidate; do not create it unless asked.

## File Write Rules (macOS TCC / FDA、life#77 follow-up)

When this skill is invoked from `run_morning_brief.sh` (or any LaunchDaemon-spawned wrapper), claude binary may NOT have Full Disk Access (FDA) for `/Users/kta/.local/share/life/_life/` (TCC blocks per-binary; bash/python have FDA but claude is version-dir based and grant doesn't survive updates).

Rules:

- **NEVER use the Write tool to write a file under `/Users/kta/.local/share/life/_life/...` directly.** It silently fails or returns a "permission denied" / "sandbox blocked" error.
- The wrapper script (`run_morning_brief.sh`) gives you a target MD path under `${repo}/ideas/task-review/md/` (gitignored). **Write only there.**
- HTML rendering / `/Users/kta/.local/share/life/_life/` artifact creation is done by the wrapper *after* this skill returns, via `python3 render_morning_brief.py` (python has FDA).
- For `pj_activity.json` etc. that the skill *reads* from `/Users/kta/.local/share/life/_life/task-review/`: read-only access via the Read tool may or may not work depending on TCC scope. If the file is missing or unreadable, proceed without it and note `(pj_activity.json absent)` in the output.

## Calendar Write Rules

Calendar writing is allowed only after explicit user approval.

Allowed flow:

1. Present Calendar block candidates with numbers.
2. Wait for the user to approve, e.g. `1と3をCalendarに入れて`.
3. Use `scripts/google_calendar_create.py --execute` only for approved blocks.

Never create events automatically while answering an initial planning request.

Initial event creation supports only:

- `title`
- `start`
- `end`
- `timezone`
- optional short `description`

Do not create attendee, location, notification email, recurring, or URL-rich events unless the user explicitly asks and the implementation supports it.

## Output Shape

For today/tomorrow:

```markdown
# 今日/明日のタスク: YYYY-MM-DD

## Calendar

| 時間 | 予定 |
|---|---|

## 今日/明日やるべきこと

1. ...
   - 理由:
   - 所要時間:
   - 推奨時間:

## Gmail要対応

- ...

## Gmail要確認

- 締切・依頼系: N件
- MTG・日程系: N件

## 空き時間の使い方

| 時間帯 | 使い方 |
|---|---|

## Calendarに入れる候補

1. HH:MM-HH:MM ...
2. ...
```

For next week:

```markdown
# 来週のタスク: YYYY-MM-DD to YYYY-MM-DD

## 既にある予定・制約

## 来週の大枠

- 月曜:
- 火曜:
- 水曜:
- 木曜:
- 金曜:

## 期限・重要タスク

## Calendarに入れる候補
```

Keep final answers concise. If no tasks are found, say so and suggest 1-3 sensible next checks.

## Validation

Before final response:

1. Confirm the date range used.
2. Confirm whether Calendar was read successfully.
3. Confirm which source files were read when the answer depends on repo notes.
4. If Calendar write candidates are included, ensure no event was created unless the user explicitly approved it.
