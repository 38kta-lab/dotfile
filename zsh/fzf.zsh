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

# tmux session switcher (^j)
# tmux ls を fzf で表示し、preview に各セッションの window 一覧を出す。
# tmux 内なら switch-client、tmux 外なら attach する。
# ^j は LF だが端末の Enter は ^m なので通常の改行とは競合しない。
if command -v tmux >/dev/null 2>&1 && command -v fzf >/dev/null 2>&1; then
  function tmux-session-fzf() {
    local session
    session=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | fzf \
      --prompt='tmux> ' --height=40% --reverse \
      --preview 'tmux list-windows -t {} -F "#{window_index}: #{window_name} [#{pane_current_command}]"')
    if [ -n "$session" ]; then
      if [ -n "$TMUX" ]; then
        tmux switch-client -t "$session"
        zle reset-prompt
      else
        BUFFER="tmux attach -t $session"
        zle accept-line
      fi
    else
      zle reset-prompt
    fi
  }
  zle -N tmux-session-fzf
  bindkey '^j' tmux-session-fzf
fi
