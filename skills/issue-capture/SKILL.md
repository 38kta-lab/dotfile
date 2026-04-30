---
name: issue-capture
description: "Extract, structure, create, and update GitHub Issues from conversations, notes, plans, and task descriptions. Use when the user says or implies: Issueにして, タスクを切って, やることを整理して, Issue候補, GitHub Issue, Projectsに追加, this should be an issue, break this into tasks, capture action items, or organize work into To do/Pending/In progress/Done."
---

# Issue Capture

Use this skill to turn conversations or notes into appropriately scoped GitHub Issues and Project tasks.

## Read Repo Policy

Before deciding where or how to capture work:

1. Read `README.md` for directory policy and Issue policy.
2. Read `Rules.md` for GitHub Projects status limits and safety rules.
3. Search relevant memory summaries with `$agent-memory` behavior if memory may contain prior decisions.

For this `life` repo, task state is managed by GitHub Projects `Status`, not labels. Project details are documented in `Rules.md`; the `Life` Project number is `5`.
Use the Project table view as the primary verification surface. Treat the board view as secondary.

## Status Limits

Use GitHub Projects `Status` as the source of task state.

```text
To do: 30
Pending: 10
In progress: 5
Done: no limit
```

For the `life` repo, current Status option IDs are documented in `Rules.md`.
`To do` is the default Status for new tasks.

Labels are for classification, domains, or metadata. Do not use labels as the task status source.

Before creating an Issue, adding it to a Project, or changing Status:

1. Identify the relevant GitHub Project and its Status field.
2. Count items in `To do`, `Pending`, and `In progress` when possible.
3. Do not add or move work into a Status that is already at its limit.
4. If a Status is full, propose consolidation, closing/done-ing existing work, or keeping the item as a Markdown candidate.

If Project owner, project number, field name, or status options are unknown, ask the user instead of guessing.

## Capture Decision

Create or suggest a GitHub Issue when the work has any of these:

- multiple steps
- progress tracking need
- deadline
- external dependency
- research or decision-making
- value for later review

Do not create an Issue for trivial one-line reminders or immediately finished tasks unless the user explicitly asks.

If the task is not ready for an Issue, save it as a Markdown candidate under the location described in `README.md`, usually `ideas/weekly/` for review candidates.

## Issue Shape

Use concise Japanese by default unless the user asks otherwise.

Issue body template:

```markdown
## Goal

## Background

## Tasks

- [ ] 

## Definition of Done

## References

## Notes
```

Keep the title action-oriented and specific.

## GitHub Workflow

Use `gh` for Issues and Projects.

Before creating:

1. Draft title, body, labels, Project, and intended Status.
2. Confirm with the user unless the user explicitly asked to create it directly and the scope is unambiguous.
3. Check Status limits.

After creating or updating:

```bash
gh issue view <number>
```

Report the Issue number, URL, Project/Status if set, and any unresolved follow-up.
When an Issue is moved to `Done`, close the GitHub Issue automatically unless the user explicitly asks to keep it open.

## Project Commands

Prefer `gh` commands and inspect available Project metadata before making changes. Exact commands may vary by GitHub CLI version and Project type.

Useful starting points:

```bash
gh issue list --state open --limit 100
gh issue view <number>
gh project list --owner <owner>
gh project item-list <project-number> --owner <owner> --limit 100
```

If `gh` lacks a needed operation or project metadata is ambiguous, stop and ask for the missing Project details.

## Memory Check

When capturing work that may depend on prior decisions, first search memory summaries in the repo memory directory documented in `Rules.md`.
Use relevant memories as context, but avoid reading unrelated full memory files.
