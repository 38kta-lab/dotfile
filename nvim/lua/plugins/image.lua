-- image.nvim: Neovim 内で画像表示 (molten-nvim の Phase 2 用)。
-- 参照: https://github.com/3rd/image.nvim
--
-- 構成:
--   - backend = "kitty" (wezterm の kitty graphics protocol を利用)
--   - processor = "magick_cli" (luarocks の magick lua binding ではなく ImageMagick CLI 経由 →
--     bootstrap が brew imagemagick だけで済み、luarocks 不要)
--   - tmux passthrough は dotfile/tmux/tmux.conf で `allow-passthrough on` 設定済
--   - fenrir 限定 (molten と同じ運用方針)

local on_fenrir = vim.fn.hostname() == "fenrir"

return {
  {
    "3rd/image.nvim",
    enabled = on_fenrir,
    ft = { "python", "markdown" },
    config = function()
      require("image").setup({
        backend = "kitty",
        processor = "magick_cli", -- luarocks 不要 (brew imagemagick の `magick` CLI を利用)
        integrations = {
          markdown = {
            enabled = true,
            clear_in_insert_mode = false,
            download_remote_images = false,
            only_render_image_at_cursor = false,
            filetypes = { "markdown" },
          },
        },
        max_width = nil,
        max_height = nil,
        max_width_window_percentage = nil,
        max_height_window_percentage = 50,
        window_overlap_clear_enabled = true,
        window_overlap_clear_ft_ignore = { "cmp_menu", "cmp_docs", "" },
        editor_only_render_when_focused = false,
        tmux_show_only_in_active_window = true,
        hijack_file_patterns = {}, -- molten 経由のみで使うので auto-hijack なし
      })
    end,
  },
}
