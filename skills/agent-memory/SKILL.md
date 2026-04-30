---
name: agent-memory
description: "Save, recall, list, update, and organize repository working memories. Use when the user says or implies: 記憶して, 覚えておいて, 保存して, 思い出して, 前のメモを確認して, memory一覧, メモを探して, remember this, save this, recall, list memories, check notes, or when context should be preserved for resuming later."
---

# Agent Memory

Use this skill to preserve and retrieve working context as Markdown files in the current repository.

## Locate Memory Directory

Before saving, listing, or recalling memories:

1. Read the current repository's `Rules.md`.
2. Find the documented Codex working-memory location.
3. Use that path as the memory directory.

For this `life` repository, `Rules.md` defines `.codex/memories/agent-memory/`.

If `Rules.md` does not define a memory directory, ask the user where to store memories. Do not silently choose a global location.

## Safety

Treat repository memories as git-shared notes. Do not store secrets, directly abusable personal identifiers, unpublished research data, collaborator confidential information, or other material prohibited by the repository's rules.

## Core Rule

Use a summary-first workflow.

1. Search memory summaries with `rg`.
2. Decide which files are relevant from frontmatter.
3. Read only the relevant memory files.
4. Save or update concise, self-contained Markdown notes.

Repository notes and user-facing Markdown should follow the language policy of the current repo. In `life`, write notes in Japanese unless the user asks otherwise.

For multi-machine setup, environment, or resume notes, avoid vague phrases such as "このPC". Prefer `host <hostname>` form, for example `host kta38-Air`. Get the short hostname with:

```bash
hostname -s
```

## Search

Replace `$MEMORY_DIR` with the path from `Rules.md`.

```bash
rg "^summary:" "$MEMORY_DIR"
rg "^summary:.*keyword" "$MEMORY_DIR" -i
rg "^tags:.*keyword" "$MEMORY_DIR" -i
rg "keyword" "$MEMORY_DIR" -i
```

## List

When the user asks to list memories, show a compact index before reading full files.

```bash
find "$MEMORY_DIR" -type f -name '*.md' | sort
rg "^(summary|created|updated|status|tags):" "$MEMORY_DIR" -n
```

Report each memory as:

```text
- YYYY-MM-DD-short-topic.md: summary / status / tags
```

If there are more than 20 memory Markdown files, warn that the memory limit has been exceeded and propose consolidation.

## Save

Save when the user asks to remember something, or when preserving context would clearly help resume later.

Before saving:

1. Count memory Markdown files with `find "$MEMORY_DIR" -type f -name '*.md'`.
2. Keep at most 20 memory Markdown files total unless the repository rules say otherwise.
3. If adding a new memory would exceed the limit, consolidate, delete obsolete content, or ask the user which memory to retire.
4. Check whether an existing memory should be updated instead of creating a new file.

Filename rule:

```text
$MEMORY_DIR/YYYY-MM-DD-short-topic.md
```

Use the current local date. Use short lowercase kebab-case English or romanized topic words for the filename. Keep detailed Japanese text inside the Markdown body, not in the filename.

Required frontmatter:

```yaml
---
summary: "Specific 1-2 line description of what this memory contains"
created: YYYY-MM-DD
---
```

Recommended optional fields:

```yaml
updated: YYYY-MM-DD
status: in-progress # in-progress | resolved | blocked | abandoned
tags: [tag-one, tag-two]
related: [path/or/issue]
```

Recommended body sections:

```markdown
# Title

## Context

## Decisions

## Current State

## Next Actions
```

Use only the sections that are useful.
When machine-specific state matters, include the hostname in the relevant bullet or sentence rather than relying on relative wording like "this PC" or "other PC".

## Recall

When the user asks to remember or check prior notes:

1. Search summaries first.
2. Search tags or full text only if summaries are insufficient.
3. Read the smallest set of relevant memory files.
4. Answer with the remembered facts, uncertainty, and where the memory came from.

## Maintain

- Update memories when facts change; add or refresh `updated`.
- Mark stale work as `resolved`, `blocked`, or `abandoned` instead of silently leaving it ambiguous.
- Consolidate scattered memories on the same topic when they become hard to scan.
- Promote durable, shareable knowledge to normal repository areas when appropriate.
