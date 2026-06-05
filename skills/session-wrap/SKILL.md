---
name: session-wrap
description: "Triage all pending and in_progress TaskList items before /clear, routing each to a durable location (GitHub Issue / PJ hub Tasks / inbox / Calendar / keep / drop) so nothing is lost on session clear. Use when the user says session-wrap, /session-wrap, セッション終わる前にタスク整理, /clear する前に, wrap up tasks, 残タスク振り分け, 残 task 整理, or wants pending tasks rescued from the session-scoped TaskList before clearing."
metadata:
  short-description: "Route pending TaskList items to durable places before /clear"
---

# Session Wrap

End-of-session triage: walk through every pending and in_progress `TaskList` item, ask the user where each should live next, and execute the move so nothing is lost on `/clear`.

This skill is intended for the `life` repo.

## Repository Rules

Before any write:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for the Issue 化判定 (γ 軸) and Status=Pending 用法.
3. Per `Rules.md`「日時認識 (毎ターン)」run `date "+%Y-%m-%d %H:%M:%S %A %Z"` once at the start so the date used for inbox / Calendar writes is correct.

## When To Invoke

User-triggered only. Typical cues:

- `session-wrap` / `/session-wrap`
- 「`/clear` する前に残タスク整理」
- 「今日の pending どうする」
- セッションを畳む前の brief な確認

Do NOT auto-invoke on session start, Stop hook, or any cron path. This skill always runs interactively.

## Workflow

1. Run `TaskList` and collect items with status `pending` or `in_progress`. Skip `completed` and `deleted`. If the list is empty, report "残 pending なし、`/clear` で安全に畳めます" and exit.
2. For each remaining item, show a compact one-line summary:
   - `#<id> [<status>] <subject>` — plus 1-line description excerpt if the subject alone is ambiguous
   - If the description already references an existing Issue / Calendar event / hub, surface that fact ("既に Issue #99 あり" / "Calendar event 登録済" / "hub M08 に紐付き") so the user can pick option (6) cleanly.
3. Ask the user to pick a destination via `AskUserQuestion` (one question per item — do not batch):

   - **(1) Issue** — GitHub Issue を `gh issue create` で作る (status-trackable, 複数日, 締切あり)
   - **(2) PJ hub Tasks** — `projects/active/<slug>.md` の `## Tasks` 節に追記。slug が曖昧なら追加で確認
   - **(3) inbox** — `ideas/inbox/YYYY-MM-DD.md` に 1 行追記 (内部で `quick-capture` skill のロジックを使う)
   - **(4) Calendar block** — `scripts/google_calendar_create.py --execute` で event 作成 (日時 + 所要時間を追加質問)
   - **(5) keep-session** — 次の session でも続けるので動かさない (no write)
   - **(6) drop** — `TaskUpdate status=deleted` で session 上から削除 (durable には残さない)

   全件 ASK 固定: routing デフォルト推論は使わない (誤って依然必要な item を sub-optimal な場所に書き出すリスクを避ける)。
4. ユーザーが選んだ destination を **直ちに実行** する (次の item に進む前)。失敗したら item を `pending` のまま残し、summary でフラグする。
5. すべての item を処理し終えたら、summary を出力 (下記)。`/clear` は **自動実行しない**、ユーザー判断に任せる。

## Reporting

最終出力は表形式の 1 ブロックで:

```
Session Wrap Summary (N items)
──────────────────────────────
#<id>  <subject>                     → <routed to> <URL/path>
...
```

最後に 1 行: 「残 N 件すべて durable な場所に移しました。`/clear` で安全に session を畳めます。」

drop した item の理由メモは summary 内 (人間が読む 1 行) にのみ書き、ファイルには残さない (= ephemeral)。

## What This Skill Does NOT Do

- `/clear` を自動実行しない。ユーザーが手動で `/clear` する。
- routing 先を勝手に推論しない。すべて `AskUserQuestion`。
- `completed` / `deleted` の task に触らない。
- Stop hook / session 開始 / cron で発火しない。
- session 内会話で出てきた sensitive な情報を Issue / inbox / hub に書き出さない (Rules.md 安全規定に従う)。

## Safety

- Rules.md の secret / PII / 未公開研究データ / 共同研究機密 / 未公開原稿の禁則を遵守。
- session ログに password / token / 個人識別情報があっても、durable artifact には絶対に書き込まない。
- inbox / Calendar / Issue を書く前に「session 中に sensitive な内容に触れていないか」を 1 秒考えてから書く。

## Tips

- 既に Issue や Calendar 化済の item は `(6) drop` を user に提案するのが自然 (重複追跡を避けるため、session task は役目を終えている)。
- `(5) keep-session` を選んだ item は、その session を `/clear` せず継続する前提。`/clear` してしまうと結局失われるので summary で「(5) を選んだ item があるので `/clear` は推奨しません」と明示する。
- 直近で morning-brief が同じ item を翌朝に再 surface するルートは: **Issue / hub Tasks / Calendar event** のいずれかに置けば OK。inbox は weekly-review でしか拾われないことに注意。
