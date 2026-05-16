# dotfile

Personal dotfiles for zsh, WezTerm, and global Codex / Claude Code Skills.

## Initialization

```sh
./init.sh
```

`init.sh` は idempotent。以下のいずれかをやったら再実行する:

- `skills/<name>/` を追加した (新 skill)
- `skills/<name>/` を削除した (broken symlink が `link_skills` で自動 cleanup)
- `zsh/`, `wezterm/`, `nvim/`, `git/`, `lazygit/`, `czg/`, `cz-git/`, `starship/` の構成を変えた

## Bootstrap (new machine)

```sh
./bootstrap.sh
```

Then run:

```sh
gh auth login
gh auth refresh -s project
git config --global ghq.root "$HOME/src"
mkdir -p "$HOME/.config/zsh" "$HOME/.config/wezterm" "$HOME/.config/codex/skills" "$HOME/.claude/skills"
./init.sh
```

`./bootstrap.sh` also installs Miniforge3 into `~/miniforge3` when missing.
`./init.sh` links `zsh/env.zsh`, which loads conda shell support without
auto-activating `base`.

## Manual bootstrap (no script)

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo "" >> "$HOME/.zprofile"
echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> "$HOME/.zprofile"
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
brew tap jesseduffield/lazygit
brew tap olets/tap
brew install antigen
brew install zsh-abbr
brew install --cask wezterm@nightly
brew install --cask font-hackgen-nerd
brew install starship
brew install neovim
brew install fzf
brew install bat
brew install zoxide
brew install fd
brew install ripgrep
brew install gh
brew install ghq
brew install jesseduffield/lazygit/lazygit
brew install git-delta
brew install ghostscript
brew install imagemagick
brew install node
brew install mermaid-cli
brew install tectonic
brew install tree-sitter
brew install tree-sitter-cli
npm install -g git-cz czg cz-git
npx -y czg --api-key="sk-XXXX"
```

Clone this repo with ghq, then install:

```sh
gh auth login
gh auth refresh -s project
git config --global ghq.root "$HOME/src"
mkdir -p "$HOME/.config/zsh" "$HOME/.config/wezterm" "$HOME/.config/codex/skills" "$HOME/.claude/skills"
ghq get https://github.com/38kta-lab/dotfile
cd "$(ghq root)/github.com/38kta-lab/dotfile"
./install_miniforge.sh
./init.sh
```

`gh auth refresh -s project` is required on each machine where Codex or `gh`
updates GitHub Projects, such as the `Life` project Status field.

## Codex / Gemini CLI

```sh
npm install -g @openai/codex
mkdir -p ~/.config/codex
mv ~/.codex/* ~/.config/codex/
codex sign-in
npm install -g @google/gemini-cli
```

## Miniforge / Conda

Miniforge3 is installed under:

```text
~/miniforge3
```

Install or verify it:

```sh
./install_miniforge.sh
```

Use a pinned Miniforge release when needed:

```sh
MINIFORGE_VERSION=25.11.0-0 ./install_miniforge.sh
```

The installer supports Apple Silicon and Intel macOS by selecting the matching
installer from the official conda-forge/miniforge GitHub releases:

```text
https://github.com/conda-forge/miniforge/releases
```

`base` should not auto-activate:

```sh
conda config --set auto_activate_base false
```

For per-repo environments, prefer `environment.yml` in that repo:

```sh
conda env create -f environment.yml
conda activate <env-name>
```

If an environment already exists:

```sh
conda env update -f environment.yml --prune
```

## Google Calendar Credentials

For Codex-assisted Calendar reads in the `life` repo, place the OAuth desktop
client JSON at:

```text
~/.config/life/google-calendar-credentials.json
```

Copy this file between personal Macs using a private secure channel. Do not
commit it to git, and do not create a public/shared link.

On a new Mac:

```sh
mkdir -p "$HOME/.config/life"
mv "$HOME/Downloads/google-calendar-credentials.json" "$HOME/.config/life/google-calendar-credentials.json"
chmod 600 "$HOME/.config/life/google-calendar-credentials.json"
```

If the downloaded file has a `client_secret_*.json` name:

```sh
mkdir -p "$HOME/.config/life"
mv "$HOME/Downloads"/client_secret_*.json "$HOME/.config/life/google-calendar-credentials.json"
chmod 600 "$HOME/.config/life/google-calendar-credentials.json"
```

Do not copy this token between Macs:

```text
~/.config/life/google-calendar-read-token.json
```

Generate that token separately on each Mac by running the Calendar reader from
the `life` repo after activating its conda environment:

```sh
conda activate life
python scripts/google_calendar_read.py --format json
```

## Skills (Codex / Claude Code)

Global user Skills are managed in this repo under:

```text
skills/
```

`./init.sh` links each directory under `skills/` into both:

```text
~/.config/codex/skills/
~/.claude/skills/
```

System Skills under `~/.config/codex/skills/.system/` are not managed here.
Claude Code's auto memory under `~/.claude/projects/.../memory/` is also not managed here.

## PR Workflow (squash)

Use PRs with squash merge to keep `main` clean and reduce cross-machine conflicts.
Rule of thumb: update `main`, but do not work directly on it.

Branch naming (one branch per machine):
- `work/<hostname>` (example: `work/kta38-mini-lab`)

Get `<hostname>` with:

```sh
hostname -s
```

Initial setup (first time on a machine):

```sh
HOST="$(hostname -s)"
git switch main
git pull --rebase
git switch -c "work/$HOST"
git push -u origin "work/$HOST"
```

Flow (manual):

```sh
# start work (every time)
git switch main
git pull --rebase
git switch work/<hostname>
git rebase main

# work + commit
git add -A
git commit -m "feat: ..."
git push -u origin work/<hostname>
```

Create a PR from `work/<hostname>` to `main`:

```sh
gh pr create --base main --head work/<hostname> --fill
```

Then **Squash and merge** it on GitHub, or with gh:

```sh
gh pr merge <PR_NUMBER> --squash
```

Merge commit (no squash):

```sh
gh pr merge <PR_NUMBER> --merge
```

Aliases (see `zsh/alias.zsh`):

```sh
winit   # initial setup: create/push work/<hostname> branch
wmain   # update main only (before switching)
wstart  # start work: update main -> switch work/<hostname> -> rebase
wrebase # rebase current work branch onto main
prc     # gh pr create --base main --head work/<hostname> --fill
prs     # gh pr merge --squash
prm     # gh pr merge --merge
```

Then on other machines:

```sh
git switch main
git pull --rebase
```

Notes:
- Keep `work/<hostname>` rebased onto `main` to avoid long-lived divergence.
- Squash keeps history clean; use merge commits only when you need full commit history preserved.
- Avoid pushing directly to `main`.

## Notes

- WezTerm keybinds are managed at `wezterm/keybinds.lua` and linked to `~/.config/wezterm/keybinds.lua`.
- Global Skills are managed under `skills/` and linked to both `~/.config/codex/skills/` and `~/.claude/skills/`.
- `~/.config/.czrc` is not committed; see `czrc/.czrc.example` for a template.

## Mac Setup Checklist

Keyboard
- Input source: `日本語 - ローマ字入力`
- Input mode: `英字`
- Caps Lock: `オフの時「英字」を入力`

Trackpad
- Tracking speed: `Max`
- Tap to click: `オン`

Pointer
- Size: `1つ`大きくする
- Fill: `#D05654`
- Outline: `#464758`

iCloud
- Desktop and Documents sync: `オン`

Desktop
- `スタックを使用`
- `表示オプションを表示`
  - テキストサイズ: `10`
  - 並べ替え: `種類`
  - 表示順序: `名前`
  - アイコン: `36x36`
  - グリッド間隔: `下から4番目`

Dock
- Position: `左`
- Automatically show/hide: `オン`
- Size/zoom: いい感じに

Default browser
- `Chrome`

## Mac app

- Zoom: Download is [here](https://zoom.us/ja/download)
- Microsoft: Word, Excel, Powerpoint
- Magnet: Download is [here](https://apps.apple.com/jp/app/magnet/id441258766?mt=12)
- Gmail, Google calender
- Google drive for mac: Download is [here](https://support.google.com/drive/answer/10838124?sjid=14873508860033578048-NC)
- ChimeraX: Download is [here](https://www.cgl.ucsf.edu/chimerax/download.html)
