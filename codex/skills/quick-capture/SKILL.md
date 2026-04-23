---
name: quick-capture
description: "Append a quick Japanese inbox note to ideas/inbox/YYYY-MM-DD.md for sudden ideas, lightweight todos, research thoughts, tool ideas, and things to revisit later. Use when the user says quick-capture, さっとメモ, メモして, 思いついた, 後で考える, inboxに入れて, or wants to capture an idea without making a GitHub Issue yet."
metadata:
  short-description: "Append quick notes to ideas/inbox"
---

# Quick Capture

Append lightweight notes and sudden ideas to the current repository's daily inbox file.

## Repository Rules

Before writing output:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety and repo-specific note rules.

For the `life` repo, save quick captures to:

```text
ideas/inbox/YYYY-MM-DD.md
```

Use the local execution date for `YYYY-MM-DD`.

## What To Capture

Use this skill for lightweight, not-yet-structured items:

- sudden ideas
- small todos
- questions to revisit
- tool or automation ideas
- research thoughts that are not ready for a project file
- possible future issues that should first pass through weekly review

Do not use this skill for durable Codex working memory. Use `agent-memory` when the note is mainly for Codex to resume later.

Do not use this skill for multi-step work that the user explicitly wants tracked now. Use `issue-capture` for that.

## Safety

Treat inbox notes as git-tracked Markdown.

Do not record secrets, API keys, access tokens, passwords, private keys, directly abusable personal identifiers, unpublished research data, collaborator confidential information, or unpublished manuscripts/applications unless the user explicitly permits it.

If the user tries to capture sensitive material, write a redacted safe version or ask how to generalize it.

## Workflow

1. Identify the capture text from the user request.
2. Create `ideas/inbox/` if needed.
3. Create or append to `ideas/inbox/YYYY-MM-DD.md`.
4. If the file is new, start with:

```markdown
# Inbox: YYYY-MM-DD

## Captures
```

5. Append one bullet per capture, newest at the bottom.
6. Add a local time prefix when available.
7. Add short tags only when obvious from the content.
8. Add a `next:` hint only when the next handling step is clear.

## Entry Shape

Use this shape:

```markdown
- HH:MM メモ本文
  - tags: #tag-one #tag-two
  - next: 週次レビューでIssue化するか判断
```

Omit `tags` or `next` if they would be forced.

Keep entries short. Do not expand a quick capture into a full plan unless the user asks.

## Triage Hints

When the capture clearly implies multi-step work, add:

```markdown
  - next: `$issue-capture` でIssue候補にする
```

When it looks like a future project, add:

```markdown
  - next: `$pj-hub` でProject化を検討
```

When it is just a reminder or idea, leave it as-is for weekly review.

## Reporting

After appending, report:

- the file path
- the captured text in one short line
- any `next:` hint added
