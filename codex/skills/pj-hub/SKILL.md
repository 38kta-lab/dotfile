---
name: pj-hub
description: "Create, update, and review project hub Markdown files under projects/active/ for research projects, manuscripts, server/admin work, tooling, and other multi-step efforts. Use when the user says pj-hub, project hub, PJ管理, Project管理, プロジェクト整理, MTGまでのTodo, checkpoint, milestone, deadline, repo付きProject, or wants goals, context, milestones, meetings/checkpoints, tasks, outputs, blockers, next actions, and related issues organized without immediately creating GitHub Issues."
metadata:
  short-description: "Manage project hub Markdown files"
---

# PJ Hub

Manage project-level Markdown files that connect goals, context, deadlines, meetings/checkpoints, repositories, tasks, outputs, blockers, next actions, and related issues.

## Repository Rules

Before changing project structure or creating project files:

1. Read `README.md` for directory policy.
2. Read `Rules.md` for safety, information-quality rules, and Project/Issue policy.

For the `life` repo, use:

```text
projects/active/
projects/archive/
```

Do not copy confidential project data, unpublished research datasets, private manuscripts, or collaborator-sensitive details into `life` unless the user explicitly permits it. Prefer links, repo paths, high-level status, and next actions.

## When To Use

Use this skill for multi-step efforts that need project-level context, such as:

- research projects
- manuscript or presentation preparation
- meeting preparation with deadlines
- server or infrastructure administration
- Codex/tooling setup
- long-running learning or writing efforts

Use `quick-capture` for quick unstructured notes. Use `issue-capture` when the user wants GitHub Issues created or Project Status changed.

## File Naming

Use lowercase kebab-case English or romanized slugs:

```text
projects/active/project-slug.md
```

When archiving, move to:

```text
projects/archive/project-slug.md
```

Do not create many top-level project categories at first. Use tags inside files instead.

## Project File Shape

Use this template for new projects:

```markdown
---
summary: "1-2 line description of the project"
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active # active | pending | blocked | archived | done
tags: [research, writing, infrastructure, tooling]
related: []
---

# Project Name

## Goal

## Scope

## Context

## Repositories

| Repo | Local Path | Visibility | Notes |
|---|---|---|---|

## Milestones

| Date | Milestone | Required State |
|---|---|---|

## Meetings / Checkpoints

| Date | Type | Goal | Prep |
|---|---|---|---|

## Tasks

### Deadline-Bound

- [ ] 

### Before Next Checkpoint

- [ ] 

### Long-Running

- [ ] 

## Outputs

## Current State

## Blockers

## Next Actions

## Related Issues

## Notes
```

Omit empty sections only when they are clearly irrelevant. Keep enough structure for weekly review and future updates.

## Workflow

1. Identify whether the user wants to create a new project, update an existing one, or list/review projects.
2. Search existing project summaries before creating:

```bash
rg "^(summary|created|updated|status|tags|related):|^# " projects/active projects/archive -n
```

3. If creating a project, choose a clear slug and create `projects/active/<slug>.md`.
4. If updating, read only the relevant project file.
5. Keep updates concise and dated. Update `updated: YYYY-MM-DD`.
6. Split concrete execution tasks into `Tasks` and `Next Actions`.
7. Add Issue candidates under `Related Issues` or `Notes`, but do not create GitHub Issues unless the user asks or invokes `issue-capture`.
8. If the project is waiting on a date, person, meeting, or external event, use `status: pending`.
9. If the project is complete, set `status: done` or move it to `projects/archive/` only when the user asks or the repository policy supports it.

## Review Behavior

When asked what to do next for a project:

- prioritize deadline-bound tasks
- then tasks before the next checkpoint
- then blockers
- then 1-3 next actions

When asked to prepare for a meeting/checkpoint:

- summarize current state
- list what must be ready by the checkpoint
- identify missing inputs
- propose a short prep checklist

When asked to connect to repos:

- record repo name, local path, visibility, and brief purpose
- do not scan private repo contents unless the user asks
- do not copy sensitive contents into the project file

## Weekly Review

Project files under `projects/active/` are valid inputs for `weekly-review`. Keep `Next Actions`, `Blockers`, and `Meetings / Checkpoints` current enough to be summarized weekly.
