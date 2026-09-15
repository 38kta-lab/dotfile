#!/usr/bin/env bash
set -euo pipefail

# Install Homebrew if missing
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Ensure Homebrew is on PATH for this shell and future zsh sessions
if ! grep -q 'brew shellenv zsh' "$HOME/.zprofile" 2>/dev/null; then
  echo "" >> "$HOME/.zprofile"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> "$HOME/.zprofile"
fi
eval "$(/opt/homebrew/bin/brew shellenv zsh)"

DOTFILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Homebrew 7 から公式以外の tap は明示的に信頼しないと formula を読めない。
# 信頼情報は ~/.homebrew/trust.json（マシンごと）なので、この repo では持てない。
brew trust olets/tap

# パッケージの一覧は Brewfile が正本。ここに個別の brew install を増やさないこと
# （2箇所に書くと必ずずれる。実際 herdr/ghostty と zoxide がずれていた）。
brew bundle --file="$DOTFILE_DIR/Brewfile"

"$DOTFILE_DIR"/install_miniforge.sh

if command -v npm >/dev/null 2>&1; then
  npm install -g git-cz czg cz-git
else
  echo "npm not found; skip git-cz/czg/cz-git install"
fi

echo "Next:"
echo "  gh auth login"
echo "  git config --global ghq.root \"$HOME/src\""
echo "  mkdir -p \"$HOME/.config/zsh\" \"$HOME/.config/wezterm\" \"$HOME/.config/codex/skills\" \"$HOME/.claude/skills\""
echo "  npx -y czg --api-key=\"sk-XXXX\""
echo "  ./init.sh"
