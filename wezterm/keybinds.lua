local wezterm = require("wezterm")
local act = wezterm.action

-- Show which key table is active in the status area
wezterm.on("update-right-status", function(window, pane)
  local name = window:active_key_table()
  if name then
    name = "TABLE: " .. name
  end
  window:set_right_status(name or "")
end)

return {
  keys = {
    -- ============================================================
    -- herdr 一本化 (2026-08-17):
    --   pane/tab/workspace の prefix 操作は herdr (prefix = Ctrl+q) に移譲。
    --   wezterm は Ctrl+q を掴まない (wezterm.lua で config.leader 撤去)。
    --   以下は leader 無しの直接 chord。workspace/tab 移動などマルチプレクサ本来の
    --   仕事は herdr 側へ寄せ、ここには「fenrir gui-startup の4分割 (wezterm-native
    --   pane) を併存期に触る最小限」だけを Cmd+Alt 系で残す。
    -- ============================================================

    -- コマンドパレット表示
    { key = "p", mods = "SUPER", action = act.ActivateCommandPalette },
    -- Tab移動
    { key = "Tab", mods = "CTRL", action = act.ActivateTabRelative(1) },
    { key = "Tab", mods = "SHIFT|CTRL", action = act.ActivateTabRelative(-1) },
    -- Tab新規作成
    { key = "t", mods = "SUPER", action = act({ SpawnTab = "CurrentPaneDomain" }) },
    -- Tabを閉じる
    { key = "w", mods = "SUPER", action = act({ CloseCurrentTab = { confirm = true } }) },

    -- 画面フルスクリーン切り替え
    { key = "Enter", mods = "ALT", action = act.ToggleFullScreen },

    -- コピーモード (wezterm-native pane 用): Cmd+Alt+[
    { key = "[", mods = "SUPER|ALT", action = act.ActivateCopyMode },
    -- コピー
    { key = "c", mods = "SUPER", action = act.CopyTo("Clipboard") },
    -- 貼り付け
    { key = "v", mods = "SUPER", action = act.PasteFrom("Clipboard") },

    -- wezterm-native pane 分割 (ad-hoc): Cmd+Alt+d / Cmd+Alt+r
    { key = "d", mods = "SUPER|ALT", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
    { key = "r", mods = "SUPER|ALT", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
    -- wezterm-native pane を閉じる: Cmd+Alt+x
    { key = "x", mods = "SUPER|ALT", action = act({ CloseCurrentPane = { confirm = true } }) },
    -- wezterm-native pane 移動: Cmd+Alt+hjkl
    { key = "h", mods = "SUPER|ALT", action = act.ActivatePaneDirection("Left") },
    { key = "l", mods = "SUPER|ALT", action = act.ActivatePaneDirection("Right") },
    { key = "k", mods = "SUPER|ALT", action = act.ActivatePaneDirection("Up") },
    { key = "j", mods = "SUPER|ALT", action = act.ActivatePaneDirection("Down") },
    -- Pane選択
    { key = "[", mods = "CTRL|SHIFT", action = act.PaneSelect },
    -- 選択中のPaneのみ表示 (zoom): Cmd+Alt+z
    { key = "z", mods = "SUPER|ALT", action = act.TogglePaneZoomState },

    -- Pane番号ジャンプ Cmd+Alt+1..4 (gui-startup の生成順 = 画面左→右・上→下):
    --   1 = col1 / 2 = col2 / 3 = col3上 (tmux life) / 4 = col3下 (sub shell)
    { key = "1", mods = "SUPER|ALT", action = act.ActivatePaneByIndex(0) },
    { key = "2", mods = "SUPER|ALT", action = act.ActivatePaneByIndex(1) },
    { key = "3", mods = "SUPER|ALT", action = act.ActivatePaneByIndex(2) },
    { key = "4", mods = "SUPER|ALT", action = act.ActivatePaneByIndex(3) },

    -- フォントサイズ切替
    { key = "+", mods = "CTRL", action = act.IncreaseFontSize },
    { key = "-", mods = "CTRL", action = act.DecreaseFontSize },
    -- フォントサイズのリセット
    { key = "0", mods = "CTRL", action = act.ResetFontSize },

    -- タブ切替 Cmd + 数字
    { key = "1", mods = "SUPER", action = act.ActivateTab(0) },
    { key = "2", mods = "SUPER", action = act.ActivateTab(1) },
    { key = "3", mods = "SUPER", action = act.ActivateTab(2) },
    { key = "4", mods = "SUPER", action = act.ActivateTab(3) },
    { key = "5", mods = "SUPER", action = act.ActivateTab(4) },
    { key = "6", mods = "SUPER", action = act.ActivateTab(5) },
    { key = "7", mods = "SUPER", action = act.ActivateTab(6) },
    { key = "8", mods = "SUPER", action = act.ActivateTab(7) },
    { key = "9", mods = "SUPER", action = act.ActivateTab(-1) },

    -- コマンドパレット
    { key = "p", mods = "SHIFT|CTRL", action = act.ActivateCommandPalette },
    -- 設定再読み込み
    { key = "r", mods = "SHIFT|CTRL", action = act.ReloadConfiguration },
    -- キーテーブル用: resize は Cmd+Alt+s (wezterm-native pane 用)。
    -- activate_pane テーブルは Cmd+Alt+hjkl の直接 chord で代替できるため撤去。
    { key = "s", mods = "SUPER|ALT", action = act.ActivateKeyTable({ name = "resize_pane", one_shot = false }) },
  },
  -- キーテーブル
  -- https://wezfurlong.org/wezterm/config/key-tables.html
  key_tables = {
    -- Paneサイズ調整 leader + s
    resize_pane = {
      { key = "h", action = act.AdjustPaneSize({ "Left", 1 }) },
      { key = "l", action = act.AdjustPaneSize({ "Right", 1 }) },
      { key = "k", action = act.AdjustPaneSize({ "Up", 1 }) },
      { key = "j", action = act.AdjustPaneSize({ "Down", 1 }) },

      -- Cancel the mode by pressing escape
      { key = "Enter", action = "PopKeyTable" },
    },
    activate_pane = {
      { key = "h", action = act.ActivatePaneDirection("Left") },
      { key = "l", action = act.ActivatePaneDirection("Right") },
      { key = "k", action = act.ActivatePaneDirection("Up") },
      { key = "j", action = act.ActivatePaneDirection("Down") },
    },
    -- copyモード leader + [
    copy_mode = {
      -- 移動
      { key = "h", mods = "NONE", action = act.CopyMode("MoveLeft") },
      { key = "j", mods = "NONE", action = act.CopyMode("MoveDown") },
      { key = "k", mods = "NONE", action = act.CopyMode("MoveUp") },
      { key = "l", mods = "NONE", action = act.CopyMode("MoveRight") },
      -- 最初と最後に移動
      { key = "^", mods = "NONE", action = act.CopyMode("MoveToStartOfLineContent") },
      { key = "$", mods = "NONE", action = act.CopyMode("MoveToEndOfLineContent") },
      -- 左端に移動
      { key = "0", mods = "NONE", action = act.CopyMode("MoveToStartOfLine") },
      { key = "o", mods = "NONE", action = act.CopyMode("MoveToSelectionOtherEnd") },
      { key = "O", mods = "NONE", action = act.CopyMode("MoveToSelectionOtherEndHoriz") },
      --
      { key = ";", mods = "NONE", action = act.CopyMode("JumpAgain") },
      -- 単語ごと移動
      { key = "w", mods = "NONE", action = act.CopyMode("MoveForwardWord") },
      { key = "b", mods = "NONE", action = act.CopyMode("MoveBackwardWord") },
      { key = "e", mods = "NONE", action = act.CopyMode("MoveForwardWordEnd") },
      -- ジャンプ機能 t f
      { key = "t", mods = "NONE", action = act.CopyMode({ JumpForward = { prev_char = true } }) },
      { key = "f", mods = "NONE", action = act.CopyMode({ JumpForward = { prev_char = false } }) },
      { key = "T", mods = "NONE", action = act.CopyMode({ JumpBackward = { prev_char = true } }) },
      { key = "F", mods = "NONE", action = act.CopyMode({ JumpBackward = { prev_char = false } }) },
      -- 一番下へ
      { key = "G", mods = "NONE", action = act.CopyMode("MoveToScrollbackBottom") },
      -- 一番上へ
      { key = "g", mods = "NONE", action = act.CopyMode("MoveToScrollbackTop") },
      -- viweport
      { key = "H", mods = "NONE", action = act.CopyMode("MoveToViewportTop") },
      { key = "L", mods = "NONE", action = act.CopyMode("MoveToViewportBottom") },
      { key = "M", mods = "NONE", action = act.CopyMode("MoveToViewportMiddle") },
      -- スクロール
      { key = "b", mods = "CTRL", action = act.CopyMode("PageUp") },
      { key = "f", mods = "CTRL", action = act.CopyMode("PageDown") },
      { key = "d", mods = "CTRL", action = act.CopyMode({ MoveByPage = 0.5 }) },
      { key = "u", mods = "CTRL", action = act.CopyMode({ MoveByPage = -0.5 }) },
      -- 範囲選択モード
      { key = "v", mods = "NONE", action = act.CopyMode({ SetSelectionMode = "Cell" }) },
      { key = "v", mods = "CTRL", action = act.CopyMode({ SetSelectionMode = "Block" }) },
      { key = "V", mods = "NONE", action = act.CopyMode({ SetSelectionMode = "Line" }) },
      -- コピー
      { key = "y", mods = "NONE", action = act.CopyTo("Clipboard") },

      -- コピーモードを終了
      {
        key = "Enter",
        mods = "NONE",
        action = act.Multiple({ { CopyTo = "ClipboardAndPrimarySelection" }, { CopyMode = "Close" } }),
      },
      { key = "Escape", mods = "NONE", action = act.CopyMode("Close") },
      { key = "c", mods = "CTRL", action = act.CopyMode("Close") },
      { key = "q", mods = "NONE", action = act.CopyMode("Close") },
    },
  },
}

