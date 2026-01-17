# aliases and abbreviations
alias ls='ls -F --color=auto'
alias vim='nvim'

if command -v abbr >/dev/null 2>&1; then
  abbr -S ll='ls -l' >>/dev/null
  abbr -S la='ls -A' >>/dev/null
  abbr -S lla='ls -l -A' >>/dev/null
fi

# vpn (Cisco Secure Client)

# 起動（起動時に自動でVPN接続される前提）
vpnup() {
  open -a "Cisco Secure Client"
}

# 終了（VPN切断 → GUI終了）
vpndown() {
  pkill -x "Cisco Secure Client" 2>/dev/null
}
