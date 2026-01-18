#!/usr/bin/env bash
set -euo pipefail

# Install Homebrew if missing
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

brew install --cask wezterm@nightly
brew install neovim
brew install gh
brew install ghq
brew install jesseduffield/lazygit/lazygit
brew install git-delta

if command -v npm >/dev/null 2>&1; then
  npm install -g git-cz czg cz-git
else
  echo "npm not found; skip git-cz/czg/cz-git install"
fi

echo "Next:"
echo "  gh auth login"
echo "  ./install.sh"
