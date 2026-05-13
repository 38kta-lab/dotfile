-- molten-nvim: Jupyter kernel cell 実行 + 結果表示を nvim 内で。
-- Phase 1: text 出力のみ (画像表示なし、image.nvim は後で Phase 2 で追加)。
-- 参照: https://github.com/benlubas/molten-nvim
--
-- 前提:
--   - **fenrir 限定**: conda env `nvim` + kernel discovery + JupyterHub 連携が fenrir 上のみセットアップ済。
--     他ホスト (Air / mini-lab) では plugin を install しない (enabled flag で skip)。
--   - Python provider (pynvim + jupyter_client) は conda env `nvim` 経由 (options.lua で `vim.g.python3_host_prog` 設定済)
--   - kernel は jupyter で discovery される (`shared-py310`, `shared-r44` を `~/Library/Jupyter/kernels/` に登録済)
--   - 使用 cwd: 各研究 repo (例: 12_L_pyshell_interactors/ipynb/) で nvim 起動
--
-- 基本ワークフロー:
--   1. `.py` を開く (cell 区切り = `# %%`)、または `.ipynb` を開く (jupytext.nvim が自動変換)
--   2. `:MoltenInit` で kernel 選択 (shared-py310 等)
--   3. `<localleader>e` (operator) or 範囲選択 + `<localleader>e` (visual) で cell 実行
--   4. 結果は仮想行 (virt text) で表示、`<localleader>mo` で詳細 window 開く
--
-- LazyVim の `<localleader>` デフォルト = `\` (backslash)
local on_fenrir = vim.fn.hostname() == "fenrir"

return {
  {
    "benlubas/molten-nvim",
    enabled = on_fenrir,
    version = "^1.0.0",
    build = ":UpdateRemotePlugins",
    ft = { "python" },
    init = function()
      vim.g.molten_image_provider = "none" -- Phase 1: 画像なし
      vim.g.molten_output_win_max_height = 20
      vim.g.molten_virt_text_output = true
      vim.g.molten_auto_open_output = false
      vim.g.molten_wrap_output = true
      vim.g.molten_virt_lines_off_by_1 = true
    end,
    keys = {
      { "<localleader>mi", function() vim.cmd("MoltenInit") end, desc = "Molten: init kernel" },
      { "<localleader>md", function() vim.cmd("MoltenDeinit") end, desc = "Molten: deinit kernel" },
      { "<localleader>e",  function() vim.cmd("MoltenEvaluateOperator") end, desc = "Molten: evaluate operator" },
      { "<localleader>ml", function() vim.cmd("MoltenEvaluateLine") end, desc = "Molten: evaluate line" },
      { "<localleader>mr", function() vim.cmd("MoltenReevaluateCell") end, desc = "Molten: re-evaluate cell" },
      { "<localleader>e",  function() vim.cmd("MoltenEvaluateVisual") end, mode = "v", desc = "Molten: evaluate visual" },
      { "<localleader>mc", function() vim.cmd("MoltenInterrupt") end, desc = "Molten: interrupt kernel" },
      { "<localleader>mh", function() vim.cmd("MoltenHideOutput") end, desc = "Molten: hide output" },
      { "<localleader>mo", function() vim.cmd("MoltenShowOutput") end, desc = "Molten: show output" },
      { "<localleader>ms", function() vim.cmd("MoltenEnterOutput") end, desc = "Molten: enter output window" },
    },
  },
  -- jupytext.nvim: .ipynb を開くと自動で python 表現に変換、保存で .ipynb に書き戻し。
  -- molten-nvim が ft=python で動くので、.ipynb もこれ経由で扱える。
  -- fenrir 限定 (molten と組で運用、他ホストでは ipynb 編集を当面行わない方針)。
  {
    "GCBallesteros/jupytext.nvim",
    enabled = on_fenrir,
    lazy = false,
    config = function()
      require("jupytext").setup({
        style = "markdown",   -- or "hydrogen": .ipynb cells を `# %%` 区切りの python に変換
        output_extension = "auto",
        force_ft = nil,
      })
    end,
  },
}
