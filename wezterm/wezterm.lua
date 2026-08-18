local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.automatically_reload_config = true
config.font = wezterm.font("HackGen Console NF")
config.font_size = 10.0
config.use_ime = true
-- 背景透過を控えめに調整 (2026-08-18)。旧=0.5/20、完全offなら1.0/0。
config.window_background_opacity = 0.75
config.macos_window_background_blur = 10

-- レイアウトは gui-startup で「先に maximize → 実最大化サイズを分割」する方式に変更。
-- これで各 Mac が自分の全画面を同じ比率で割るため、解像度/DPI が違っても分割比が揃う
-- (mini-home 基準)。固定 initial_cols/rows のハックは不要になったので撤去。

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
	-- pane 境界線を金色 (アクティブタブと同色) にして分割構造を見やすく
	split = "#ae8b2d",
}

-- 非アクティブ pane を暗く沈め、アクティブ pane を一目で分かるようにする
config.inactive_pane_hsb = {
	saturation = 0.5,
	brightness = 0.3,
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
-- leader は撤去 (2026-08-17)。Ctrl+q は herdr(内側マルチプレクサ)の prefix に譲渡。
-- wezterm 側の pane/tab 操作は leader 無しの直接 chord (Cmd+Alt 系) に移設した (keybinds.lua)。
-- config.leader = { key = "q", mods = "CTRL", timeout_milliseconds = 2000 }

-- 起動時 (2026-08-18): herdr 基準運用に移行し、単一 pane で fenrir に ssh → herdr に attach。
-- wezterm 側の複数 pane 分割・tmux 連携 (旧 col1-3 / Ctrl+J fzf) は廃止。
-- pane/tab/workspace の管理は接続先 fenrir の herdr (prefix=Ctrl+q) が担う。
--   - `herdr` は既存の永続 session に attach (無ければ起動)。
--   - detach (Ctrl+q q) 後は fenrir のログインシェルに落ちる → 再 attach は `herdr`、
--     Air/mini-lab に戻るなら `exit`。
-- すべて Tailscale 経由 (`~/.ssh/config` の Host fenrir)。PATH は env.zsh が ~/.zshenv 経由で
-- 投入するため非対話 ssh でも herdr にパスが通る。
wezterm.on("gui-startup", function(cmd)
	local tab, pane, window = wezterm.mux.spawn_window(cmd or {})
	window:gui_window():maximize()
	pane:send_text("ssh fenrir -t 'herdr; exec zsh -l'\n")
end)

return config
