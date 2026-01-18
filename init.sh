#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZSH_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
WEZTERM_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/wezterm"

timestamp() {
  date +%Y%m%d%H%M%S
}

backup_path() {
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
      backup_path "$dest"
    fi
    ln -sfn "$src" "$dest"
  done
}

link_wezterm() {
  local src="$REPO/wezterm/wezterm.lua"
  local dest="$WEZTERM_DIR/wezterm.lua"
  if [ -e "$src" ]; then
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      backup_path "$dest"
    fi
    ln -sfn "$src" "$dest"
  fi

  local key_src="$REPO/wezterm/keybinds.lua"
  local key_dest="$WEZTERM_DIR/keybinds.lua"
  if [ -e "$key_src" ]; then
    if [ -e "$key_dest" ] && [ ! -L "$key_dest" ]; then
      backup_path "$key_dest"
    fi
    ln -sfn "$key_src" "$key_dest"
  fi
}

link_config_dir() {
  local src="$1"
  local dest="$2"
  if [ -e "$src" ]; then
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      backup_path "$dest"
    fi
    ln -sfn "$src" "$dest"
  fi
}

link_starship() {
  local src="$REPO/starship/starship.toml"
  local dest="${XDG_CONFIG_HOME:-$HOME/.config}/starship.toml"
  if [ -e "$src" ]; then
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      backup_path "$dest"
    fi
    ln -sfn "$src" "$dest"
  fi
}

install_czrc_template() {
  local src="$REPO/czrc/.czrc.example"
  local dest="${XDG_CONFIG_HOME:-$HOME/.config}/.czrc"
  if [ -e "$src" ] && [ ! -e "$dest" ]; then
    cp "$src" "$dest"
  fi
}

write_zshrc() {
  local target="$HOME/.zshrc"
  local tmp
  tmp="$(mktemp)"

  cat > "$tmp" <<'EOF'
# Managed by dotfile init.sh
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

  backup_path "$target"
  mv "$tmp" "$target"
}

verify() {
  if zsh -lic 'echo "zsh ok"'; then
    echo "verify: zsh ok"
  else
    echo "verify: zsh failed"
  fi

  if zsh -lic 'type -w td >/dev/null 2>&1'; then
    echo "verify: td found"
  else
    echo "verify: td not found"
  fi
}

main() {
  ensure_dirs
  link_zsh
  link_wezterm
  link_config_dir "$REPO/nvim" "${XDG_CONFIG_HOME:-$HOME/.config}/nvim"
  link_config_dir "$REPO/git" "${XDG_CONFIG_HOME:-$HOME/.config}/git"
  link_config_dir "$REPO/lazygit" "${XDG_CONFIG_HOME:-$HOME/.config}/lazygit"
  link_config_dir "$REPO/czg" "${XDG_CONFIG_HOME:-$HOME/.config}/czg"
  link_config_dir "$REPO/cz-git" "${XDG_CONFIG_HOME:-$HOME/.config}/cz-git"
  link_starship
  install_czrc_template
  write_zshrc
  verify
}

main "$@"
