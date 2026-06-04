# ghq
# 2026-06-04: NFS symlink (例 ~/src/.../07_G_plasmidshuffling →
# /data/kta/_repos/07_G_plasmidshuffling) を bat が follow すると
# macOS の Network Volume TCC プロンプトが出るため、symlink 検知時は
# bat を呼ばず readlink で target を表示するだけにする。bat の version
# 更新で再許可が要らなくなる。
if command -v ghq >/dev/null 2>&1 && command -v fzf >/dev/null 2>&1; then
  function ghq-fzf() {
    local src
    src=$(ghq list | fzf --preview '
      repo="$(ghq root)/{}"
      if [ -L "$repo" ]; then
        printf "📦 %s\n\n" "{}"
        printf "🔗 symlink → %s\n\n" "$(readlink "$repo")"
        printf "(NFS-backed; README preview skipped to avoid macOS Network Volume TCC prompt)\n"
      else
        bat --color=always --style=header,grid --line-range :80 "$repo"/README.* 2>/dev/null
      fi
    ')
    if [ -n "$src" ]; then
      BUFFER="cd $(ghq root)/$src"
      zle accept-line
    fi
    zle -R -c
  }
  zle -N ghq-fzf
  bindkey '^g' ghq-fzf
fi
