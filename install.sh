#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZSH_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
WEZTERM_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/wezterm"

timestamp() {
  date +%Y%m%d%H%M%S
}

backup_file() {
  local path="$1"
  if [ -e "$path" ] && [ ! -L "$path" ]; then
    mv "$path" "${path}.bak.$(timestamp)"
  fi
}

ensure_dirs() {
  mkdir -p "$ZSH_DIR" "$WEZTERM_DIR"
}

link_zsh() {
  for src in "$REPO"/zsh/*.zsh; do
    [ -e "$src" ] || continue
    local dest="$ZSH_DIR/$(basename "$src")"
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      backup_file "$dest"
    fi
    ln -sfn "$src" "$dest"
  done
}

link_wezterm() {
  local src="$REPO/wezterm/wezterm.lua"
  local dest="$WEZTERM_DIR/wezterm.lua"
  if [ -e "$src" ]; then
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      backup_file "$dest"
    fi
    ln -sfn "$src" "$dest"
  fi
}

write_zshrc() {
  local target="$HOME/.zshrc"
  local tmp
  tmp="$(mktemp)"

  cat > "$tmp" <<'EOF'
# Managed by dotfile install.sh
ZSH_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
for file in \
  "$ZSH_CONFIG_DIR/env.zsh" \
  "$ZSH_CONFIG_DIR/plugins.zsh" \
  "$ZSH_CONFIG_DIR/alias.zsh" \
  "$ZSH_CONFIG_DIR/queue.zsh" \
  "$ZSH_CONFIG_DIR/fzf.zsh"
do
  [ -f "$file" ] && source "$file"
done
EOF

  if [ -f "$target" ] && cmp -s "$tmp" "$target"; then
    rm -f "$tmp"
    return 0
  fi

  backup_file "$target"
  mv "$tmp" "$target"
}

verify() {
  if zsh -lic 'echo "zsh ok"'; then
    echo "verify: zsh ok"
  else
    echo "verify: zsh failed"
  fi

  if command -v td >/dev/null 2>&1; then
    echo "verify: td found"
  else
    echo "verify: td not found"
  fi
}

main() {
  ensure_dirs
  link_zsh
  link_wezterm
  write_zshrc
  verify
}

main "$@"
