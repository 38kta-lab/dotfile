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
brew install --cask wezterm@nightly
brew install neovim
brew install fzf
brew install bat
brew install gh
brew install ghq
brew install jesseduffield/lazygit/lazygit
brew install git-delta
npm install -g git-cz czg cz-git
```

Clone this repo with ghq, then install:

```sh
gh auth login
ghq get https://github.com/38kta-lab/dotfile
cd "$(ghq root)/github.com/38kta-lab/dotfile"
./init.sh
```

## Notes

- WezTerm keybinds are managed at `wezterm/keybinds.lua` and linked to `~/.config/wezterm/keybinds.lua`.
- `~/.config/.czrc` is not committed; see `czrc/.czrc.example` for a template.
