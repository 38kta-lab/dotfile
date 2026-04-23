# Output Template

Use this structure for `ideas/daily/md/YYYY-MM-DD-trend.md`.
After writing it, render `ideas/daily/YYYY-MM-DD-trend.html` with `scripts/render_trend_html.py`.

```markdown
# Search Trend: YYYY-MM-DD

## 実行条件

- 対象日: YYYY-MM-DD
- 論文・プレプリント検索キーワード:
- ニュース取得方針: キーワード検索なし。Nature News、Science / AAAS News、ナゾロジー（自然科学）の対象日投稿を確認。
- 研究機関発表: 通常は確認しない。ユーザーが明示した場合だけ指定期間で確認。
- 参照したportfolio:
- 取得日: YYYY-MM-DD

## 論文・プレプリント

### Source Name

| 原文タイトル | タイトル訳 | 興味度 | カテゴリ |
|---|---|---|---|
| [Original title](https://example.com) |  | ★★★☆☆ | #matched-keyword |
| [Low relevance title](https://example.com) |  | ☆☆☆☆☆ | #matched-keyword |

## 科学ニュース

### Source Name

| 原文タイトル | タイトル訳 | 興味度 |
|---|---|---|
| [Original title](https://example.com) |  | ★★★☆☆ |
| [Low relevance title](https://example.com) |  | ☆☆☆☆☆ |

### ナゾロジー（自然科学）

| 原文タイトル | 興味度 |
|---|---|
| [日本語タイトル](https://example.com) | ★★★☆☆ |

## 研究機関発表

Only include this section when the user explicitly requested institution announcements.

### Source Name

| 原文タイトル | タイトル訳 | 興味度 |
|---|---|---|
| [日本語の研究機関発表タイトル](https://example.com) |  | ★★★☆☆ |
| [Non-Japanese institution announcement title](https://example.com) | 日本語のタイトル訳 | ★★★☆☆ |

```

Do not add content summaries, `興味度の判断メモ`, or `制限・不確実性`. Keep the trend file scan-first. Do not include source sections with no results. Do not hide low-relevance records; use `☆☆☆☆☆` when there is no clear portfolio relevance. For Japanese science/news and Japanese `研究機関発表`, omit `タイトル訳`; translate only non-Japanese titles.

The HTML is the final user-facing output. The Markdown remains the editable source.
