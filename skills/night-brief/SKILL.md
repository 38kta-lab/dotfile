---
name: night-brief
description: "End-of-day planning brief for tomorrow. Reads tomorrow's Google Calendar (primary + TimeBlock), today's morning brief for carry-over tasks, and relevant project hub Current State sections, then writes ideas/task-review/md/night-YYYY-MM-DD.md (= tomorrow's date) with proposed [status:focus]/[status:meeting]/[status:experiment] tags for each Calendar block, carry-over tasks, upcoming deadlines, and a rough day plan. Phase 1 = manual GENERATE only; user reviews and patches [status:X] tags into Calendar separately if they want M09 Slack scheduler to auto-fire next day. Use when user says night-brief, /night-brief, 明日の予定整理, 寝る前にラフ計画, plan tomorrow, または session-wrap の後の翌日 planning."
metadata:
  short-description: "夜の planning brief — 翌日 Calendar + carry-over + status 提案 を ideas/task-review/md/night-<翌日>.md に出力"
---

# Night Brief

End-of-day planning brief for tomorrow. Companion to the morning-tasks loader: night-brief = **planning** (decide), morning-tasks = **execution** (pick up).

## Repository Rules

Before any write:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety + Calendar event title 書式 + Issue 化判定.
3. Per `Rules.md` 「日時認識 (毎ターン)」run `date "+%Y-%m-%d %H:%M:%S %A %Z"` once at the start so today/tomorrow are correct.

This skill is intended for the `life` repo. If invoked elsewhere, stop and report.

## Purpose

End-of-day planning artifact for tomorrow that:

- pre-decides `[status:X]` tag candidates per Calendar block (so M09 Slack scheduler can auto-apply when user patches them in)
- carries over today's unfinished items (from `morning-<today>.md` + session TaskList residue)
- flags upcoming deadlines (next 7 days window)
- gives a rough 1-day plan with time-block intent

Goal: user goes to bed with tomorrow's shape settled. Next morning, `/morning-tasks` picks up the morning brief (cron) — which itself can build on the night brief.

## When To Invoke

User-triggered only. Typical cues:

- `night-brief` / `/night-brief`
- 「明日の予定整理」「明日の status 決めたい」「寝る前にラフ計画」
- session-wrap の後の延長線 (今日の作業を closure → 明日の planning)
- セッションを `/clear` する前の brain-dump

Do NOT auto-invoke. Do NOT run from morning-brief cron (that's a separate artifact).

## Inputs (auto-read)

1. **今日の morning brief**: `ideas/task-review/md/morning-<today>.md` — 今日 plan されたが終わっていない項目を carry-over 候補に
2. **翌日 Calendar (primary)**: `python scripts/google_calendar_read.py --start <tomorrow> --end <day-after-tomorrow>` で primary 取得
3. **翌日 Calendar (TimeBlock)**: 同 script を `--calendar-id c_5d59fafa55dcd44b5890fbc12dd4a9b2fb60bbdaa625e266eae5223e5cdf718d@group.calendar.google.com` で取得
4. **直近 PJ hub Current State** (軽く scan): `projects/active/*.md` の冒頭 + Current State 節 (深読みは不要、ongoing 状態の把握程度)
5. **Issue 締切**: 必要なら `gh issue list --state open --json title,body` で `〆/締切/deadline` ワードを grep (オプション、軽い)

## Output

`ideas/task-review/md/night-<tomorrow-YYYY-MM-DD>.md`

ファイル名の日付は **brief 対象 = 翌日** (作成日ではない)。理由: 翌朝 morning brief が `morning-<today>.md` を見るとき、対応する night brief が同じ日付になっていると carry-over が直感的。

### Template

```markdown
# Night Brief: 明日の予定 — YYYY-MM-DD (曜)

> 作成: YYYY-MM-DD HH:MM JST (= 前日夜)
> 対象範囲: YYYY-MM-DD (曜) 00:00 〜 翌々日 00:00 (Asia/Tokyo)

## 翌日 Calendar

| 時間 | 予定 | status 案 | 紐付け / 備考 |
|---|---|---|---|
| HH:MM–HH:MM | (event title) | `[status:focus]` 等 | PJ 紐付け or 性質 |

(各 event 1 行、status 案は本ファイル最下節「status 提案 heuristics」に従う)

## 翌日やるべきこと候補

(carry-over from today's morning brief + 新規に明日着手すべき項目)

1. **<件名>**
   - 由来: morning-<today>.md #N / inbox / hub / 新規
   - 所要時間: ~h
   - 推奨時間: HH:MM 帯 / 空き時間で

## 締切ウォッチ (向こう 7 日以内)

- YYYY-MM-DD (曜): <件名> (Issue #N or hub 参照)

## 翌日 1 日の rough plan

| 時間帯 | 使い方 | status |
|---|---|---|
| 〜09:00 | <自由 / morning 仕込み> | (なし) |
| ... | ... | `[status:X]` |

## 翌朝 morning brief への引継ぎ

- (今夜時点で気付いた reminder、不確実性、観察したい点)
- (例) 「6/10 (水) UTAS S2 入力の有無を朝に確認」「植物実習の集合場所要確認」

## (オプション) status patch コマンド

night brief で決めた status を Calendar に焼き付ける時に user が実行:

\`\`\`bash
# 例: event の title 末尾に [status:focus] tag を追加
python scripts/google_calendar_create.py --event-id <ID> --title "[A02] 【MTG】xxx [status:meeting]"
\`\`\`

(Phase 1 では skill 側で auto-patch しない。user が手動 OR Phase 3 の自動化を待つ)
```

## status 提案 heuristics

| Calendar event 性質 | status 案 |
|---|---|
| MTG (人と話す、`【MTG】` 含む title) | `[status:meeting]` |
| seminar / 講義 (受講側、E02 等) | `[status:meeting]` (passive) |
| 実験・実習・現地調査 (E01 植物実習等) | `[status:experiment]` |
| solo focus block (申請書 drafting / 解析 / paper-close-reading 等) | `[status:focus]` |
| 休憩 / 自由 / 移動 | (none) or `[status:break]` |
| 病院・私用 | (none) or `[status:offsite]` |

PJ tag (`[NN_L]` / `[A##]` / `[E##]` 等) の event は title の意味から推測。曖昧な場合は `[status:focus]` を default。

## Phase 1 Scope (現バージョン)

- ✅ skill 手動起動で night brief md を生成
- ✅ 翌日 Calendar + carry-over + status 提案 + rough plan を template に従って書く
- ❌ Calendar event への [status:X] tag auto-patch (Phase 3 で検討)
- ❌ cron 自動起動 (Phase 2 で検討)

## What This Skill Does NOT Do

- 自動で Calendar event を patch しない (user が brief 見て手動で patch、または将来 Phase 3 で自動化)
- morning brief を上書き / 修正しない
- session-scoped TaskCreate に load しない (それは morning-tasks の仕事、当日朝にやる)
- 過去日付の brief を作らない (常に「翌日」のみ)
- Slack status を直接変更しない (M09 scheduler が cron で実行する役割)

## Safety

- Rules.md の secret / PII / 未公開研究データ / 共同研究機密 / 未公開原稿の禁則を遵守
- night brief は git-tracked / portal 配信される durable artifact、sensitive な内容は書かない
- 翌日の予定に sensitive 情報 (患者名 / 学生氏名等) が含まれる場合は generic な表現に置換 (例: 「病院」だけにする、診療科や担当医名は書かない)

## Tips

- night-brief 起動の理想タイミング: 夕食後〜寝る 1h 前。眠る直前は brief 見て不安が増す可能性、就寝 30 min 前で読み終えるくらい
- carry-over の判断: 「今日中にやる予定だったが終わっていない」かつ「明日以降に効力がある」もののみ。完全に意味を失った task は drop してよい (session-wrap (6) drop と同思想)
- 締切ウォッチは 7 日先まで。それより先は morning brief / weekly review で扱う
- 不確実性が高い予定 (「明日朝の体調次第」「天気依存」等) は明示的に書く。翌朝 morning brief で再判断できるように
