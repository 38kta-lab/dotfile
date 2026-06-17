# aliases and abbreviations
alias ls='ls -F --color=auto'
alias vim='nvim'

if command -v abbr >/dev/null 2>&1; then
  abbr -S ll='ls -l' >>/dev/null
  abbr -S la='ls -A' >>/dev/null
  abbr -S lla='ls -l -A' >>/dev/null
fi

# gh: PR helpers (secondary PC の緊急退避から main へ取り込むためのもの)
# fenrir = primary は 2026-05-16 から main 直接運用、これらは不要。
# secondary (Air / mini-lab) で緊急退避中に書いた work/<host> を main へ戻すときに使う。
alias prc='gh pr create --base main --head work/$(hostname -s) --fill'
alias prm='gh pr merge --merge'                    # 現在 branch の PR を merge (branch keep)
alias prs='gh pr merge --squash'
alias prmn='gh pr merge --merge'                   # 番号 or branch を引数で指定: prmn 42
alias prsn='gh pr merge --squash'

# git: per-machine workflow helpers
# fenrir: main 直接運用 (work/fenrir 廃止、2026-05-16〜)
# secondary: 緊急退避時のみ work/<host> を使う
alias wmain='git switch main && git pull --rebase'
wstart() {
  # fenrir は main 直接、secondary は work/<host> へ
  if [[ "$(hostname -s)" == "fenrir" ]]; then
    git switch main && git pull --rebase
  else
    git switch main && git pull --rebase && git switch "work/$(hostname -s)" && git rebase main
  fi
}
alias wrebase='git rebase main'
# winit: secondary PC で緊急退避用 branch を初めて作るとき (1 回だけ)
alias winit='HOST=$(hostname -s) && git switch main && git pull --rebase && git switch -c "work/$HOST" && git push -u origin "work/$HOST"'

# guppy job submission (GPU server, no Slurm). See life repo
# `scripts/automation/run_on_guppy.sh` + `_shared/conventions.md`.
alias gsub='bash ~/src/github.com/38kta-lab/life/scripts/automation/run_on_guppy.sh'
alias gque='ssh guppy "tmux ls 2>/dev/null || echo \"(no tmux sessions)\""'
alias gtop='ssh guppy "nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv"'
glog() {
  # tail -F the latest log file under <project>/log/.
  # Usage:  glog                # default = 12_L log dir
  #         glog <log-dir>      # specify other repo's log dir
  local target_dir="${1:-/data/kta/_repos/12_L_pyshell_interactors/log}"
  local latest
  latest=$(ls -t "${target_dir}"/*.log 2>/dev/null | head -1)
  if [[ -z "$latest" ]]; then
    echo "no log files under ${target_dir}" >&2
    return 1
  fi
  echo "tail -F $latest"
  tail -F "$latest"
}

# vili (Slurm head node = ymir) sbatch helpers
alias vsub='ssh ymir sbatch'                     # vsub /data/kta/_repos/<repo>/script/sbatch/<name>.sh
alias vque='ssh ymir squeue -u kta'
alias vacc='ssh ymir sacct -u kta --starttime today'
alias vinfo='ssh ymir sinfo'

# vpn (Cisco Secure Client)

# 起動（起動時に自動でVPN接続される前提）
vpnup() {
  open -a "Cisco Secure Client"
}

# 終了（VPN切断 → GUI終了）
vpndown() {
  pkill -x "Cisco Secure Client" 2>/dev/null
}

# slack workspace 横断 status / DND (M09)
# 引数 = duration (min)、省略時は preset の既定値
_life_slack_status() {
  conda run -n life python ~/src/github.com/38kta-lab/life/scripts/slack/status_set.py "$@"
}
focus()      { _life_slack_status --preset focus      ${1:+--duration $1} }
meeting()    { _life_slack_status --preset meeting    ${1:+--duration $1} }
experiment() { _life_slack_status --preset experiment ${1:+--duration $1} }
break-time() { _life_slack_status --preset break      ${1:+--duration $1} }
off()        { _life_slack_status --clear }

# quarto: .qmd render / preview ヘルパー
# fenrir の JupyterLab ターミナル(jupyterhub env)では `quarto` が wrapper 経由で動く。
# PATH に quarto が無ければ fenrir の jupyterhub wrapper に fallback (他 host では未導入なら error)。
_life_quarto_bin() {
  command -v quarto 2>/dev/null && return 0
  local w=/Users/kta/miniforge3/envs/jupyterhub/bin/quarto
  [[ -x $w ]] && { echo "$w"; return 0; }
  return 1
}

# qrender [file.qmd] [追加の quarto 引数] : self-contained revealjs HTML に render
#   - file 省略時はカレントに .qmd が 1 つだけならそれを使う
#   - --to が無ければ revealjs を既定にする (例: qrender deck.qmd --to html / pdf)
#   出力 HTML は JupyterLab でダブルクリック → "Trust HTML" で Lab 内閲覧
qrender() {
  emulate -L zsh
  local qbin; qbin=$(_life_quarto_bin) || { echo "qrender: quarto が見つかりません (この host には未導入)" >&2; return 127; }
  local f
  if [[ -n $1 && $1 != --* ]]; then f=$1; shift
  else
    local qmds=(*.qmd(N))
    (( $#qmds == 1 )) && f=$qmds[1]
  fi
  [[ -z $f ]] && { echo "usage: qrender <file.qmd> [extra quarto args]" >&2; return 2; }
  if [[ "$*" == *--to* ]]; then "$qbin" render "$f" "$@"
  else "$qbin" render "$f" --to revealjs "$@"; fi
}

# qpreview [file.qmd] [port] : ターミナルで live preview (新規ブラウザタブを開かない、既定 port 4321)
#   ※ Lab 内表示は server-proxy 経由 (/proxy/<port>/)。proxy 周りは別途調整中
qpreview() {
  emulate -L zsh
  local qbin; qbin=$(_life_quarto_bin) || { echo "qpreview: quarto が見つかりません" >&2; return 127; }
  local f
  if [[ -n $1 && $1 != --* ]]; then f=$1; shift
  else
    local qmds=(*.qmd(N))
    (( $#qmds == 1 )) && f=$qmds[1]
  fi
  [[ -z $f ]] && { echo "usage: qpreview <file.qmd> [port]" >&2; return 2; }
  "$qbin" preview "$f" --no-browser --port "${1:-4321}" --host 127.0.0.1
}
