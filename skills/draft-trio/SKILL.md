---
name: draft-trio
description: "Generate three independent first drafts of the same writing task from Claude, Gemini, and Codex, then present them side by side with objective checks so the user can cherry-pick and merge into a final version. Use when the user says draft-trio, /draft-trio, 3案生成, 3案で書いて, 多角執筆, draft3, 独立起草, 3モデルで書いて, 申請書ドラフト3案, write it with 3 models, or wants diverse drafts (grant paragraph, abstract, review reply, cover letter, summary) to compare and hand-merge rather than trusting one model."
metadata:
  short-description: "Claude/Gemini/Codex に同一プロンプトで3案起草 → 横並び比較 → 人が統合"
---

# Draft Trio（3モデル独立起草）

同一のプロンプトを **Claude / Gemini / Codex** に**独立**して起草させ、横並びで比較し、
**user が良いとこ取り＋微調整して正本を作る**ための素材出しツール。

背景の思想（2026-08-18 の実測より）: 3モデルの文章品質は僅差で甲乙つけ難い。
だから「1つに絞る」より「**3案の多様な切り口を出させ、人が統合する**」方が価値が高い。
AIは素材出し、統合判断は人。単一モデル依存も避けられる。

## When to use
- 申請書の段落、要旨/abstract、査読コメント返信、cover letter、一般向け要約 など、
  **推敲前の初稿を複数の切り口で欲しい**とき。
- 「どのモデルが上か」を決めたいのではなく、**素材を並べて自分で仕上げたい**とき。

## Steps

### 1. プロンプトを1つに固める（最重要）
- **全モデルに渡す入力を完全に同一・自己完結**にする。曖昧な指示なら、まず user と確認して
  `prompt.md` に落とす。含めるべき要素:
  - 役割/文脈（例: 科研費若手の申請書を書く研究者）
  - **与えられた事実**（捏造防止のため材料を明示。未公開データは CLAUDE.md 方針に従い扱う）
  - 制約（字数・段落文/箇条書き可否・トーン・含めるべき数値や機構・出力は本文のみ 等）
- 同一入力にすることで、比較が公平になり、後段の**統合（マージ）もしやすくなる**。

### 2. 出力先を用意
- カレントリポジトリの `tmp/draft-trio/<slug>/` を作業ディレクトリにする（`tmp/` は非追跡）。
  `<slug>` は課題が分かる短い名前。`prompt.md` をそこに保存。

### 3. 3案を生成（同一プロンプト・model 明示）
`PROMPT="$(cat tmp/draft-trio/<slug>/prompt.md)"` を各 CLI に渡す。**事前に対話 agy を起動していないこと**（`agy -p` が弾かれる罠）。

```bash
cd tmp/draft-trio/<slug>
PROMPT="$(cat prompt.md)"

# Claude（operating とは別プロセスで独立起草）
claude -p "$PROMPT" > claude.md 2> claude.err

# Gemini（agy print モード）
agy -p "$PROMPT" --model gemini-3.1-pro-high --effort high > gemini.md 2> gemini.err

# Codex（非対話 exec。coding 土台なので "散文執筆タスク" だと分かる prompt にしておく）
codex exec -m gpt-5.6-sol -c model_reasoning_effort="high" --sandbox read-only \
  -o codex.md "$PROMPT" 2> codex.err
```

- **model 名は変わりうる**。最新は `agy models` と `~/.config/codex/models_cache.json`
  （codex）で確認し、Gemini は Pro 最上位、Codex は frontier（例 gpt-5.6-sol）を選ぶ。
- どれかが失敗したら `*.err` を見て調整（reasoning キー名や model slug の変化など）。

### 4. 横並びで提示＋客観チェック
- 3案を全文提示する。**勝者を自動で選ばない**（統合は user の仕事）。
- 課題に制約があれば客観指標を添える。例: 字数（空白除く）、必須数値/機構の有無、
  箇条書きの有無、捏造（与えた事実外の記述）の有無。
- 盲検で読みたい場合は A/B/C にシャッフルして対応表を隠す（`sort -R` でシャッフル、
  対応表は `.mapping` に退避し採点後に開示。bash 3.2 では `mapfile` 不使用）。

### 5. 人が統合 → 正本 →（任意）反証レビュー
- user が良いとこ取り・微調整して正本を作る（AIは提案まで）。
- 仕上がったら任意で **codex-review 思想の反証チェック**（別モデルに「この文章の弱点/事実誤り
  を指摘せよ」と当てる）を回すと、自己参照バイアスを避けた最終確認になる。

## Notes
- 目的は**多様性による素材出し**。3案が似通っても、語順・当事者性・具体例の差が統合の糧になる。
- Claude を `claude -p` で回すのは、operating の長い文脈に引きずられない**独立初稿**にするため。
  ネスト実行が問題なら operating Claude が直接1案を書いてもよい（その旨明記する）。
- 関連: `codex-review`（相互チェック）、`paper-close-reading` / `pj-hub`（執筆対象の供給元）。
