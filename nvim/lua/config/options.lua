-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

vim.opt.spell = false

-- Python provider for nvim plugins that need pynvim (molten-nvim 等)。
-- fenrir 専用 conda env `nvim` (pynvim + jupyter_client) を指定。
-- 他ホスト (Air / mini-lab) では env 未作成のため設定しない (skip)。
if vim.fn.hostname() == "fenrir" then
  vim.g.python3_host_prog = vim.fn.expand("$HOME/miniforge3/envs/nvim/bin/python3")
end
