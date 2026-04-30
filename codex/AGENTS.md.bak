# AGENTS.md — dotfile setup instructions

## Context
This repository is my personal dotfiles repo.

Local repo path (example):
- $HOME/src/github.com/38kta-lab/dotfile

The actual path may vary by environment.

Target locations:
- Zsh config dir: ~/.config/zsh
- Zsh entrypoint: ~/.zshrc
- WezTerm config dir: ~/.config/wezterm
- WezTerm keybinds source: ~/.config/wezterm/keybinds.lua (managed in repo)
- Codex global Skills dir: ~/.config/codex/skills

Primary goals:
1) Manage dotfiles via this repo.
2) Keep ~/.zshrc minimal (loader only).
3) Put custom commands (queue/td/tq/fzf helpers) into dedicated files under ~/.config/zsh via symlinks.
4) Never break the shell startup; changes must be safe and reversible.

## Rules
- Prefer symlinks over copying.
- Do not delete existing user files. If conflicts exist, create backups with a timestamp suffix.
- Minimize edits to ~/.zshrc. It should only source files under ~/.config/zsh (and nothing else).
- Avoid adding new dependencies unless explicitly requested.
- WezTerm keybinds are managed in repo and linked to ~/.config/wezterm/keybinds.lua.
- User-created global Codex Skills are managed in repo under codex/skills/ and linked to ~/.config/codex/skills/.
- Do not manage or copy Codex system Skills under ~/.config/codex/skills/.system/.
- Never include real API keys, tokens, or secrets in this repo. Use placeholders (e.g., sk-XXXX) and recommend secure storage instead.
- Print exact commands you run and the files you touch.

## Repository structure to create (in this repo)
Create these folders/files if missing:

- zsh/
  - env.zsh            # environment variables (optional)
  - alias.zsh          # aliases (optional)
  - queue.zsh          # queue commands: td, tq, tqpick, helpers
  - fzf.zsh            # fzf-related helpers (optional; only if needed)
- wezterm/
  - keybinds.lua       # symlink target (managed in repo)
- codex/
  - skills/            # user-created global Codex Skills
- README.md            # short description + install steps
- init.sh              # idempotent installer (safe to run multiple times)

## Installation behavior (what to implement)
Implement init.sh to do the following:

1) Ensure directories exist:
   - ~/.config/zsh
   - ~/.config/wezterm
   - ~/.config/codex/skills

2) Link zsh files:
   - Link repo zsh/*.zsh into ~/.config/zsh/
     Example:
       ln -sfn "$REPO/zsh/queue.zsh" "$HOME/.config/zsh/queue.zsh"

3) Ensure ~/.zshrc is a thin loader:
   - If ~/.zshrc already exists, back it up before modifying.
   - Ensure it sources all files in ~/.config/zsh/*.zsh (or a fixed list).
   - Do not duplicate lines if already present.

4) WezTerm:
   - Link ~/.config/wezterm/keybinds.lua to the repo.
   - Add a note in README about where keybinds live.

5) Codex Skills:
   - Link each repo codex/skills/<skill-name> directory into ~/.config/codex/skills/<skill-name>.
   - Back up an existing non-symlink target before replacing it.
   - Do not touch ~/.config/codex/skills/.system/.

6) Verification:
   - After installation, run:
     - zsh -lic 'echo "zsh ok"'
     - command -v td || true
   - Print success/failure.

Idempotency requirements:
- Running init.sh multiple times must not create duplicate loader lines or break symlinks.
- It must not overwrite user configs without backup.

## Operating mode
When asked to "set up dotfiles" or "install", you should:
- Inspect current files first (ls, cat relevant parts).
- Propose a plan and then execute it.
- Keep changes minimal and incremental.

If anything is missing (e.g., fzf not installed), report it and propose the smallest next step.
