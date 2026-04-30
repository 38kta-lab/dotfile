# CLAUDE.md — dotfile setup instructions (Claude Code)

## Context
This repository is my personal dotfiles repo. The primary coding agent is Claude Code; codex usage is paused for May 2026 while migration is in progress.

Local repo path (example):
- $HOME/src/github.com/38kta-lab/dotfile

The actual path varies by machine. This repo is shared across 3 personal Macs, one branch per machine: `work/<hostname>`.

Target locations:
- Zsh config dir: ~/.config/zsh
- Zsh entrypoint: ~/.zshrc
- WezTerm config dir: ~/.config/wezterm
- WezTerm keybinds source: ~/.config/wezterm/keybinds.lua (managed in repo)
- Claude Code user dir: ~/.claude (settings, sessions, auto memory; not yet repo-managed)
- Codex global Skills dir: ~/.config/codex/skills (still linked by init.sh; under review for Claude migration)

Primary goals:
1) Manage dotfiles via this repo.
2) Keep ~/.zshrc minimal (loader only).
3) Put custom commands (queue/td/tq/fzf helpers) into dedicated files under ~/.config/zsh via symlinks.
4) Never break the shell startup; changes must be safe and reversible.
5) Keep configuration portable across the 3 Macs.

## Rules
- Prefer symlinks over copying.
- Do not delete existing user files. If conflicts exist, create backups with a timestamp suffix.
- Minimize edits to ~/.zshrc. It should only source files under ~/.config/zsh (and nothing else).
- Avoid adding new dependencies unless explicitly requested.
- WezTerm keybinds are managed in repo and linked to ~/.config/wezterm/keybinds.lua.
- Codex skills under `codex/skills/` are still linked by init.sh, but each skill is being reviewed for Claude migration. Do not modify, rename, or remove `codex/skills/<name>` contents unless explicitly asked.
- Do not auto-create skills under `~/.claude/skills/`. Skill design is decided per item with the user; do not preemptively port codex skills.
- Do not manage or copy Codex system Skills under `~/.config/codex/skills/.system/`.
- `~/.claude/settings.json` (Claude Code permissions / hooks / env) is intentionally NOT managed by this repo yet. Do not add it to `init.sh` until the user asks; permissions and hooks decisions are pending.
- `~/.claude/projects/.../memory/` is the auto memory store managed by Claude itself. Do not symlink, copy, or hand-edit it from this repo.
- Never include real API keys, tokens, or secrets in this repo. Use placeholders (e.g., `sk-XXXX`) and recommend secure storage instead.
- Print exact commands you run and the files you touch.

## Repository structure
Existing folders / files (do not break):

- `zsh/`
  - `env.zsh`, `conda.zsh`, `plugins.zsh`, `alias.zsh`, `queue.zsh`, `fzf.zsh` — sourced by the managed `~/.zshrc` loader in a fixed order
- `wezterm/`
  - `wezterm.lua`, `keybinds.lua`
- `nvim/`, `lazygit/`, `git/`, `czg/`, `cz-git/`, `czrc/`, `starship/` — config dirs / files linked by `init.sh`
- `codex/`
  - `skills/` — legacy global Codex skills (under review for Claude migration)
  - `AGENTS.md.bak` — original codex-tuned AGENTS.md, preserved for reference
- `README.md`
- `bootstrap.sh` — first-machine bootstrap (Homebrew, taps, casks, npm globals)
- `install_miniforge.sh` — Miniforge3 installer
- `init.sh` — idempotent symlink installer (safe to run multiple times)

## Installation behavior (init.sh)
`init.sh` currently does:

1) Ensure `~/.config/{zsh,wezterm,codex/skills}` exist.
2) Symlink each repo `zsh/*.zsh` into `~/.config/zsh/`.
3) Rewrite `~/.zshrc` to a thin loader that sources `~/.config/zsh/*.zsh` in a fixed order. An existing `~/.zshrc` is backed up if its content differs.
4) Symlink WezTerm files (`wezterm.lua`, `keybinds.lua`) into `~/.config/wezterm/`.
5) Symlink config dirs (`nvim`, `git`, `lazygit`, `czg`, `cz-git`) into `~/.config/`.
6) Symlink `starship/starship.toml` into `~/.config/starship.toml`.
7) Symlink each `codex/skills/<name>` into `~/.config/codex/skills/<name>` (legacy; still active).
8) Install `czrc/.czrc.example` into `~/.config/.czrc` if missing.
9) Verify with `zsh -lic 'echo "zsh ok"'` and a `td` lookup.

Idempotency requirements:
- Running `init.sh` multiple times must not create duplicate loader lines or break symlinks.
- It must not overwrite user configs without backup.

## Operating mode
When asked to "set up dotfiles" or "install":
- Inspect current files first (`ls`, read relevant parts).
- Propose a plan and then execute it.
- Keep changes minimal and incremental.

If anything is missing (e.g., `fzf` not installed), report it and propose the smallest next step.

## Migration status (codex → Claude)
- 2026-04 → 2026-05: primary agent switched from codex to Claude Code.
- The original codex-tuned `AGENTS.md` is preserved at `codex/AGENTS.md.bak`.
- `codex/skills/` remains wired into `init.sh`. Each skill is being reviewed individually for one of:
  (a) replaced by a Claude Code built-in feature (skills, auto memory, `/schedule`, etc.),
  (b) ported to `~/.claude/skills/<name>/SKILL.md`, or
  (c) kept as-is for now.
- `claude/settings.json` (permissions / hooks / env) and a `claude/skills/` tree are NOT yet introduced to this repo. Add them only when the user explicitly decides on the design.
