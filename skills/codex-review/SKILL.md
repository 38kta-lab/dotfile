---
name: codex-review
description: "Run Codex as an independent read-only reviewer over a repo to surface bugs and improvement suggestions, then summarize the findings for triage. Use when the user says codex-review, /codex-review, Codex でレビュー, Codex に監査させて, バグ検出して, 改善案を出して (Codex), run a codex audit, or wants Codex to review the current/another repo. v1 targets the life repo. Claude builds → Codex audits (mutual check)."
metadata:
  short-description: "Codex read-only review of a repo → triage findings"
---

# Codex Review

Codex を **独立した read-only レビュアー**として repo に当て、バグと改善案を検出し、結果を
severity 別に要約して user のトリアージに載せる。設計は「**Claude が構築 → Codex が監査**」の
相互チェック。Codex は repo を書き換えない。指摘の採用は人の判断を経る（**自動 Issue 化はしない**）。

システム本体・設計は life repo:
- runner: `scripts/codex-review/run_codex_review.sh`
- PJ hub: `projects/active/M14-codex-review.md`
- README: `scripts/codex-review/README.md`

## Repository Rules

最初に life repo で作業していることを確認する（別 repo なら本 skill は runner の `--repo` 経由で当てる）。
迷ったら `scripts/codex-review/README.md` を読む。

## Scope (v1)

- 既定の対象は **life repo**。`--repo <path>` で他 repo も指せるが、**research repo (02_B〜15_O 等) は
  未公開データの取り扱い境界が未設計のため、user の明示指示がない限り対象にしない**（M14 hub 参照）。

## Inputs / Modes

- **diff**（既定）: 直近コミットの差分だけをレビュー。速くて安い。日常用。
- **audit**: インフラ系コード全体（`scripts/`・automation・運用 doc）を精査。たまに回す棚卸し。

user が mode を指定しなければ **diff** を既定にする。「全体」「監査」「棚卸し」等の語があれば audit。

## Workflow

1. mode と repo を決める（既定: diff / life）。audit は時間とトークンを使うので、その旨を一言伝えてから実行する。
2. runner を実行する:
   ```bash
   bash scripts/codex-review/run_codex_review.sh --mode <diff|audit> [--base <ref>] [--repo <path>] [--focus "<観点>"]
   ```
   - stdout の最終行が生成レポートのパス。Codex 実行中は数十秒〜数分かかることがある。
   - diff で「no changes」終了したら、その旨を伝えて終わる（base を `--base HEAD~N` で広げる選択肢も案内）。
3. 生成レポート (`outputs/codex-review/<repo>/<date>-<mode>.md`) を Read で読む。
4. user に **severity 別に要約**する:
   - 高 → 中 → 低 の順。各指摘は「タイトル / `file:line` / 一言」で。レポート全文は貼らない。
   - レポートのパスも示す（後で見返せるように）。
5. **read-only 遵守の確認**: 必要なら対象 repo で `git status` が不変であることを確認して添える。
6. 採用トリアージを促す:
   - user が採用すると言った指摘だけ、`issue-capture` skill で GitHub Issue 化する（Issue 方針: DoD 1行・〜2週間 を満たすものだけ）。
   - 小さな修正は、その場で別途 user 承認のうえ対応してもよい。**Codex のレポート自体は修正の根拠であって、自動適用しない**。

## Reporting

- 読んだレポートのパス
- 検出件数（高/中/低の内訳）
- 高・中の指摘を 1 行ずつ
- 「どれを Issue 化 / 対応しますか？」とトリアージを促す

## Safety

- Codex は read-only sandbox で実行され repo を書き換えない。
- prompt 側に安全ガード（機密値・token・個人情報を出力に引用しない／研究データに触れない）があるが、
  万一レポートに機密値が混入していたら **user に知らせ、該当箇所を要約から除外**する。
- 本 skill は runner 実行とレポート要約まで。**修正の自動適用・自動 Issue 化はしない**。

## What This Skill Does NOT Do

- 修正を repo に自動適用しない（Codex は read-only、適用は人の承認後に別途）。
- 指摘を自動で大量 Issue 化しない（採用分のみ `issue-capture`）。
- research repo を既定対象にしない（未公開データ境界が未設計）。
- runner / prompt の中身を変更しない（それは M14 の通常開発として行う）。
