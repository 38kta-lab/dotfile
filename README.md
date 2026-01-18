# dotfile

Personal dotfiles for zsh and WezTerm.

## Initialization

```sh
./init.sh
```

## Bootstrap (new machine)

```sh
./bootstrap.sh
```

Then run:

```sh
gh auth login
./init.sh
```

## Manual bootstrap (no script)

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
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
```

Clone this repo with ghq, then install:

```sh
gh auth login
ghq get https://github.com/38kta-lab/dotfile
cd "$(ghq root)/github.com/38kta-lab/dotfile"
./init.sh
```

## Codex / Gemini CLI

```sh
npm install -g @openai/codex
codex sign-in
mkdir -p ~/.config/codex
mv ~/.codex/* ~/.config/codex/
npm install -g @google/gemini-cli
```

## Notes

- WezTerm keybinds are managed at `wezterm/keybinds.lua` and linked to `~/.config/wezterm/keybinds.lua`.
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
