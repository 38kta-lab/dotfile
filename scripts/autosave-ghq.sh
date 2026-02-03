#!/usr/bin/env bash
set -u

SRC_ROOT="${SRC_ROOT:-$HOME/src}"

timestamp() {
  date "+%Y-%m-%d %H:%M"
}

get_hostname() {
  local name=""
  if command -v scutil >/dev/null 2>&1; then
    name="$(scutil --get HostName 2>/dev/null || true)"
  fi
  if [ -z "$name" ]; then
    name="$(hostname -s 2>/dev/null || true)"
  fi
  echo "${name:-unknown-host}"
}

pick_remote() {
  local repo="$1"
  if git -C "$repo" remote get-url origin >/dev/null 2>&1; then
    echo "origin"
    return 0
  fi
  git -C "$repo" remote | head -n 1
}

process_repo() {
  local repo="$1"
  local status
  local hostname
  local branch
  local autosave_branch
  local remote
  local now

  if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  status="$(git -C "$repo" status --porcelain)"
  if [ -z "$status" ]; then
    return 0
  fi

  hostname="$(get_hostname)"
  autosave_branch="autosave/${hostname}"
  branch="$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

  if ! git -C "$repo" rev-parse --verify "$autosave_branch" >/dev/null 2>&1; then
    git -C "$repo" switch -c "$autosave_branch" >/dev/null 2>&1
  else
    git -C "$repo" switch "$autosave_branch" >/dev/null 2>&1
  fi

  git -C "$repo" add -A
  now="$(timestamp)"
  git -C "$repo" commit -m "chore(autosave): ${now}" >/dev/null 2>&1 || true

  remote="$(pick_remote "$repo")"
  if [ -n "$remote" ]; then
    git -C "$repo" push -u "$remote" "$autosave_branch" >/dev/null 2>&1 || true
  fi

  if [ -n "$branch" ] && [ "$branch" != "$autosave_branch" ]; then
    git -C "$repo" switch "$branch" >/dev/null 2>&1 || true
  fi
}

main() {
  if [ ! -d "$SRC_ROOT" ]; then
    echo "autosave: SRC_ROOT not found: $SRC_ROOT"
    return 0
  fi

  while IFS= read -r gitdir; do
    process_repo "${gitdir%/.git}" || true
  done < <(find "$SRC_ROOT" -type d -name .git -prune -print)
}

main "$@"
