# URL Digest Output Template

Markdown source path:

```text
ideas/daily/md/YYYY-MM-DD-digest.md
```

HTML output path:

```text
ideas/daily/YYYY-MM-DD-digest.html
```

Default `YYYY-MM-DD` is the previous calendar day in the local timezone unless the user specifies another date.

```markdown
# URL Digest: YYYY-MM-DD

## Title

- URL: <https://example.com>
- 種別: 論文 / プレプリント / 科学ニュース / 研究機関発表 / その他
- 著者: papers/preprints only, required when available
- 出典: source name
- 日付: YYYY-MM-DD or unknown
- DOI/ID: identifier if available

### コアメッセージ

2-4文。

### メモ

- 接点や使い道。
- 注意点がある場合だけ。
```

Regenerate HTML after every Markdown update.
