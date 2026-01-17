# ---- queue: td command (input only, no git) ----
typeset -a TD_PROJECTS TD_CONTEXTS
TD_PROJECTS=(Research Paper Code Finance Home)
TD_CONTEXTS=(desk lab email deep)

# Helper: select multiple items by number
# UI via /dev/tty, returns chosen items on stdout
_td_pick_multi() {
  local prompt="$1"; shift
  local -a items
  items=("$@")

  {
    print -r -- "$prompt"
    local i=1
    for item in "${items[@]}"; do
      print -r -- "  $i) $item"
      ((i++))
    done
    print -r -- "  0) (none)"
    print -n -- "> "
  } > /dev/tty

  local input
  IFS= read -r input < /dev/tty

  [[ -z "$input" || "$input" == "0" ]] && { print -r -- ""; return 0; }

  local -a chosen uniq
  local n x

  for n in ${(z)input}; do
    if [[ "$n" == <-> ]] && (( n >= 1 && n <= ${#items[@]} )); then
      chosen+=("${items[$n]}")
    fi
  done

  # de-dup while preserving order
  for x in "${chosen[@]}"; do
    if [[ " ${uniq[*]} " != *" $x "* ]]; then
      uniq+=("$x")
    fi
  done

  print -r -- "${uniq[*]}"
}

td() {
  local task="$*"
  if [[ -z "$task" ]]; then
    echo "Usage: td \"<task text>\""
    return 1
  fi

  if [[ ! -f "$TASKS_FILE" ]]; then
    echo "Error: Tasks.md not found at $TASKS_FILE"
    return 1
  fi

  cd "$QUEUE_REPO" || return 1

  local today due extra
  today="$(date +%F)"

  local picked_projects picked_contexts
  picked_projects="$(_td_pick_multi 'Select +projects:' "${TD_PROJECTS[@]}")"
  picked_contexts="$(_td_pick_multi 'Select @contexts:' "${TD_CONTEXTS[@]}")"

  {
    print -n -- "Due date (YYYY-MM-DD, default ${today}): "
  } > /dev/tty
  IFS= read -r due < /dev/tty
  [[ -z "$due" ]] && due="$today"

  if ! echo "$due" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
    echo "Error: due must be YYYY-MM-DD"
    return 1
  fi

  {
    print -n -- "Extra key:value tags (optional): "
  } > /dev/tty
  IFS= read -r extra < /dev/tty

  # Build task line (Markdown list item)
  local line="- $task"

  local p c
  for p in ${(z)picked_projects}; do
    [[ -n "$p" ]] && line="${line} +${p}"
  done
  for c in ${(z)picked_contexts}; do
    [[ -n "$c" ]] && line="${line} @${c}"
  done

  line="${line} due:${due}"
  [[ -n "$extra" ]] && line="${line} ${extra}"

  # Append to file
  if [[ -n "$(tail -c 1 "$TASKS_FILE")" ]]; then
    echo "" >> "$TASKS_FILE"
  fi
  echo "$line" >> "$TASKS_FILE"

  echo "Queued:"
  echo "  $line"
}
# ---- end ----

# queue: helpers
tq() {
  cd "$QUEUE_REPO" || return 1
  # "## Task List" 以降の "- " 行だけ抽出して fzf
  awk '
    $0 ~ /^##[[:space:]]+Task List$/ {inlist=1; next}
    inlist && $0 ~ /^##[[:space:]]+/ {inlist=0}
    inlist && $0 ~ /^- / {print}
  ' "$TASKS_FILE" | fzf --no-multi --prompt="queue> " --height=80% --border
}

tq2() {
  cd "$QUEUE_REPO" || return 1
  local today tomorrow
  today="$(date +%F)"
  tomorrow="$(date -v+1d +%F 2>/dev/null || gdate -d "tomorrow" +%F)"

  awk -v t="$today" -v tm="$tomorrow" '
    $0 ~ /^##[[:space:]]+Task List$/ {inlist=1; next}
    inlist && $0 ~ /^##[[:space:]]+/ {inlist=0}
    inlist && $0 ~ /^- / && ($0 ~ ("due:" t) || $0 ~ ("due:" tm)) {print}
  ' "$TASKS_FILE" | fzf --no-multi --prompt="due(today|tomorrow)> " --height=80% --border
}

tqpick() {
  local file="$TASKS_FILE"
  cd "$QUEUE_REPO" || return 1

  local today
  today="$(date +%F)"

  # 1) Task List からタスク行を取得して fzf
  local selected
  selected="$(
    awk '
      $0 ~ /^##[[:space:]]+Task List$/ {inlist=1; next}
      inlist && $0 ~ /^##[[:space:]]+/ {inlist=0}
      inlist && $0 ~ /^- / {print}
    ' "$file" \
    | fzf --prompt="pick for today> " --no-multi --height=80% --border
  )"

  [[ -z "$selected" ]] && return 0

  # 2) Today セクションの行番号を取得
  local today_line
  today_line="$(grep -n "^## Today" "$file" | cut -d: -f1 | head -n1)"

  if [[ -z "$today_line" ]]; then
    echo "Error: Today section not found"
    return 1
  fi

  # 3) Today 見出しの次の行に挿入し、Task List から削除
  #    ed を使って「原子操作」で編集する
  ed -s "$file" <<EOF
/$selected/
d
${today_line}a
$selected
.
w
q
EOF

  echo "Moved to Today:"
  echo "  $selected"
}
