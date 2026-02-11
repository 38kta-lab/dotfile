# aliases and abbreviations
alias ls='ls -F --color=auto'
alias vim='nvim'

if command -v abbr >/dev/null 2>&1; then
  abbr -S ll='ls -l' >>/dev/null
  abbr -S la='ls -A' >>/dev/null
  abbr -S lla='ls -l -A' >>/dev/null
fi

# gh: PR helpers
alias prc='gh pr create --base main --head work/$(hostname -s) --fill'
alias prm='gh pr merge --merge'
alias prs='gh pr merge --squash'

# git: per-machine workflow helpers
alias wmain='git switch main && git pull --rebase'
alias wstart='git switch main && git pull --rebase && git switch "work/$(hostname -s)" && git rebase main'
alias wrebase='git rebase main'
alias winit='HOST=$(hostname -s) && git switch main && git pull --rebase && git switch -c "work/$HOST" && git push -u origin "work/$HOST"'

# vpn (Cisco Secure Client)

# 起動（起動時に自動でVPN接続される前提）
vpnup() {
  open -a "Cisco Secure Client"
}

# 終了（VPN切断 → GUI終了）
vpndown() {
  pkill -x "Cisco Secure Client" 2>/dev/null
}
