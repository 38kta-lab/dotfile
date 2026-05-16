# JupyterLab Terminal (xterm.js) 検出: starship の右寄せプロンプト等が
# xterm.js の cursor 制御と衝突し、最初の 1 文字が二重表示される display バグを誘発。
# Lab context だけ starship を skip して minimal prompt に切り替え。
__in_jupyter_terminal() {
  [[ -n "$JPY_SESSION_NAME" || -n "$JUPYTER_SERVER_URL" ]]
}

if command -v starship >/dev/null 2>&1 && ! __in_jupyter_terminal; then
  eval "$(starship init zsh)"
elif __in_jupyter_terminal; then
  # minimal 2-line prompt: 1 行目に cwd と git branch、2 行目に `❯ `
  autoload -Uz vcs_info
  precmd_vcs() { vcs_info }
  precmd_functions+=(precmd_vcs)
  zstyle ':vcs_info:git:*' formats ' (%b)'
  setopt prompt_subst
  PROMPT=$'%F{cyan}%~%f%F{yellow}${vcs_info_msg_0_}%f\n%F{green}❯%f '
  RPROMPT=''
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

# JupyterLab Terminal (xterm.js) では zsh-autosuggestions の grey suggest が
# cursor 制御と干渉して最初の 1 文字が二重表示される display バグがある。
# Lab context のみ autosuggestions を OFF (zsh 自体は引き続き利用)。
# 検出は JPY_SESSION_NAME / JUPYTER_SERVER_URL の存在で行う (jupyter_server 系が export する env var)。
if [[ -n "$JPY_SESSION_NAME" || -n "$JUPYTER_SERVER_URL" ]]; then
  ZSH_AUTOSUGGEST_DISABLE=1
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
