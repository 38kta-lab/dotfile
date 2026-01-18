if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

# plugins
# zsh-abbr
if [ -f /opt/homebrew/share/zsh-abbr/zsh-abbr.zsh ]; then
  source /opt/homebrew/share/zsh-abbr/zsh-abbr.zsh
fi
if command -v abbr >/dev/null 2>&1; then
  abbr -S -qq lg='lazygit'
  abbr -S proot='cd $(git rev-parse --show-toplevel)' >>/dev/null
fi

# plugins
# antigen
if [ -f /opt/homebrew/share/antigen/antigen.zsh ]; then
  source /opt/homebrew/share/antigen/antigen.zsh

  antigen use oh-my-zsh

  antigen bundle zsh-users/zsh-autosuggestions
  antigen bundle zsh-users/zsh-syntax-highlighting
  antigen bundle zsh-users/zsh-completions

  antigen apply
fi
