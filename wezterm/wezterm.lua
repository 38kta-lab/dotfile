local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.automatically_reload_config = true
config.font = wezterm.font("HackGen Console NF")
config.font_size = 10.0
config.use_ime = true
config.window_background_opacity = 0.5
config.macos_window_background_blur = 20

-- gui-startup の split をフルサイズで計算させるため、起動ウィンドウを大きく作る。
-- 小さい既定 (80x24) のまま split → maximize すると増分が均等再配分されず
-- col3 (35:35:30 の 30) が痩せて見えるのを防ぐ。maximize は gui-startup 末尾で実行。
config.initial_cols = 320
config.initial_rows = 88

----------------------------------------------------
-- Tab
----------------------------------------------------
-- タイトルバーを非表示
config.window_decorations = "RESIZE"
-- タブバーの表示
config.show_tabs_in_tab_bar = true
-- タブが一つの時は非表示
config.hide_tab_bar_if_only_one_tab = true
-- falseにするとタブバーの透過が効かなくなる
-- config.use_fancy_tab_bar = false

-- タブバーの透過
config.window_frame = {
	inactive_titlebar_bg = "none",
	active_titlebar_bg = "none",
}

-- タブバーを背景色に合わせる
config.window_background_gradient = {
	colors = { "#000000" },
}

-- タブの追加ボタンを非表示
config.show_new_tab_button_in_tab_bar = false
-- nightlyのみ使用可能
-- タブの閉じるボタンを非表示
config.show_close_tab_button_in_tabs = false

-- タブ同士の境界線を非表示
config.colors = {
	tab_bar = {
		inactive_tab_edge = "none",
	},
}

-- タブの形をカスタマイズ
-- タブの左側の装飾
local SOLID_LEFT_ARROW = wezterm.nerdfonts.ple_lower_right_triangle
-- タブの右側の装飾
local SOLID_RIGHT_ARROW = wezterm.nerdfonts.ple_upper_left_triangle

wezterm.on("format-tab-title", function(tab, tabs, panes, config, hover, max_width)
	local background = "#5c6d74"
	local foreground = "#FFFFFF"
	local edge_background = "none"
	if tab.is_active then
		background = "#ae8b2d"
		foreground = "#FFFFFF"
	end
	local edge_foreground = background
	local title = "   " .. wezterm.truncate_right(tab.active_pane.title, max_width - 1) .. "   "
	return {
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = edge_foreground } },
		{ Text = SOLID_LEFT_ARROW },
		{ Background = { Color = background } },
		{ Foreground = { Color = foreground } },
		{ Text = title },
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = edge_foreground } },
		{ Text = SOLID_RIGHT_ARROW },
	}
end)

----------------------------------------------------
-- keybinds
----------------------------------------------------
config.disable_default_key_bindings = true
config.keys = require("keybinds").keys
config.key_tables = require("keybinds").key_tables
config.leader = { key = "q", mods = "CTRL", timeout_milliseconds = 2000 }

-- 起動時のペイン構成 (fenrir 主作業先方針、2026-06-08 更新で 35:35:30 + 30 を上下分割):
--   col1 (35%)        : ssh fenrir + tmux attach -t life (Claude Code メイン作業)
--   col2 (35%)        : ssh fenrir + 対話 zsh → Ctrl+G (ghq-fzf) 展開
--   col3 上 (30 の 80%): ssh fenrir + 対話 zsh → Ctrl+G (ghq-fzf) 展開
--   col3 下 (30 の 20%): ssh fenrir + cd life + clear + shell (sub 操作用)
-- すべて Tailscale 経由 (`~/.ssh/config` の Host fenrir で Tailscale 直 IP に解決)
-- PATH (brew shellenv + ~/.local/bin) は env.zsh が ~/.zshenv 経由で必ず投入されるため、
-- 非対話 ssh でも tmux / nvim / claude にパスが通る (zsh -lc wrapping 不要)
-- Ctrl+G = ghq-fzf zle ウィジェット (~/.config/zsh/fzf.zsh の bindkey '^g')。
-- 制御文字 \x07 (BEL = Ctrl+G) を対話 zsh 起動後に送って展開する。
wezterm.on("gui-startup", function(cmd)
	-- ssh fenrir で対話 zsh を起動 (cd life + clear)。split の size は新規ペインの比率。
	local SSH_ZSH = "ssh fenrir -t 'cd ~/src/github.com/38kta-lab/life && clear && exec zsh -l'\n"
	local CTRL_G = "\x07" -- BEL = Ctrl+G → ghq-fzf

	local tab, col1, window = wezterm.mux.spawn_window(cmd or {})
	-- col1 を 35%、残り 65% を right に。
	local right = col1:split({ direction = "Right", size = 0.65 })
	-- right (65%) から col3 (30%) を切り出す。残った right が col2 (35%)。
	local col3 = right:split({ direction = "Right", size = 30 / 65 })
	local col2 = right
	-- col3 (30%) を上 80% / 下 20% に分割。size は新規 (Bottom) の比率なので 0.2。
	local col3_bottom = col3:split({ direction = "Bottom", size = 0.2 })

	-- col1: tmux life セッションに attach (メイン作業)。
	col1:send_text("ssh fenrir -t 'tmux a -t life'\n")
	-- fzf 展開ペイン: 対話 zsh 起動後に Ctrl+G を送る。
	col2:send_text(SSH_ZSH)
	col2:send_text(CTRL_G)
	col3:send_text(SSH_ZSH)
	col3:send_text(CTRL_G)
	-- col3 下: sub 操作用の通常 shell。
	col3_bottom:send_text(SSH_ZSH)
	window:gui_window():maximize()
end)

return config
