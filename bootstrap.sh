#!/usr/bin/env bash
set -euo pipefail

# Install Homebrew if missing
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

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

if command -v npm >/dev/null 2>&1; then
  npm install -g git-cz czg cz-git
else
  echo "npm not found; skip git-cz/czg/cz-git install"
fi

echo "Next:"
echo "  gh auth login"
echo "  ./init.sh"
