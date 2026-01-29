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
git config --global ghq.root "$HOME/src"
mkdir -p "$HOME/.config/zsh" "$HOME/.config/wezterm"
./init.sh
```

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
git config --global ghq.root "$HOME/src"
mkdir -p "$HOME/.config/zsh" "$HOME/.config/wezterm"
ghq get https://github.com/38kta-lab/dotfile
cd "$(ghq root)/github.com/38kta-lab/dotfile"
./init.sh
```

## Codex / Gemini CLI

```sh
npm install -g @openai/codex
mkdir -p ~/.config/codex
mv ~/.codex/* ~/.config/codex/
codex sign-in
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

## Mac app

- Zoom: Download is [here](https://zoom.us/ja/download)
- Microsoft: Word, Excel, Powerpoint
- Magnet: Download is [here](https://apps.apple.com/jp/app/magnet/id441258766?mt=12)
- Gmail, Google calender
- Google drive for mac: Download is [here](https://support.google.com/drive/answer/10838124?sjid=14873508860033578048-NC)

