-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

vim.opt.spell = false

-- Python provider for nvim plugins that need pynvim (molten-nvim 等)。
-- 専用 conda env `nvim` を作成して pynvim + jupyter_client を入れている。
-- 他ホスト (Air / mini-lab) でも同 path でセットアップする想定。
vim.g.python3_host_prog = vim.fn.expand("$HOME/miniforge3/envs/nvim/bin/python3")
