-- molten-nvim: Jupyter kernel cell 実行 + 結果表示を nvim 内で。
-- Phase 2: image.nvim 連携で画像 (matplotlib plot 等) も表示可能。
-- 参照: https://github.com/benlubas/molten-nvim
--
-- 前提:
--   - **fenrir 限定**: conda env `nvim` + kernel discovery + JupyterHub 連携が fenrir 上のみセットアップ済。
--     他ホスト (Air / mini-lab) では plugin を install しない (enabled flag で skip)。
--   - Python provider (pynvim + jupyter_client) は conda env `nvim` 経由 (options.lua で `vim.g.python3_host_prog` 設定済)
--   - `.ipynb` 編集には jupytext が PATH に必要: nvim env に `pip install jupytext` 済 + `~/.local/bin/jupytext`
--     symlink で bare `jupytext` 解決 (jupytext.nvim が `vim.fn.system("jupytext …")` で呼ぶため)
--   - kernel は jupyter で discovery される (`shared-py310`, `shared-r44` を `~/Library/Jupyter/kernels/` に登録済)
--   - 使用 cwd: 各研究 repo (例: 12_L_pyshell_interactors/ipynb/) で nvim 起動
--   - 画像表示前提: image.nvim plugin (image.lua) + tmux allow-passthrough on (tmux/tmux.conf)
--
-- 基本ワークフロー:
--   1. `.py` を開く (cell 区切り = `# %%`)、または `.ipynb` を開く (jupytext.nvim が自動変換)
--   2. `:MoltenInit` で kernel 選択 (shared-py310 等)
--   3. `<localleader>e` (operator) or 範囲選択 + `<localleader>e` (visual) で cell 実行
--   4. 結果は仮想行 (virt text) で表示、`<localleader>mo` で詳細 window 開く
--   5. matplotlib などの図出力は output window で画像として描画される
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
      vim.g.molten_image_provider = "image.nvim" -- Phase 2: image.nvim 経由で画像表示
      vim.g.molten_output_win_max_height = 500   -- afk2777 準拠: popup 高さ上限を実質無制限化 (画像のリサイズ抑止)
      -- virt_text_output と auto_open_output は両立しない (前者が inline で表示するため後者の popup が抑止される)。
      -- Phase 2 では popup での確実な画像表示を優先 → virt_text_output = false + auto_open_output = true。
      -- 短い text 出力も popup に出る (毎回 q で閉じる運用)。
      vim.g.molten_virt_text_output = false
      vim.g.molten_auto_open_output = true
      vim.g.molten_wrap_output = true
      vim.g.molten_virt_lines_off_by_1 = true
    end,
    -- image.nvim は同じく fenrir 限定。molten が image_provider = "image.nvim" を指定するため
    -- image.nvim より後に読まれないよう dependencies で順序保証する。
    dependencies = { "3rd/image.nvim" },
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
        style = "hydrogen",   -- .ipynb cells を `# %%` 区切りの python buffer に変換 (ft=python)。
                              -- 検証済み .py フローと同じ `\eip` (= <localleader>e + inner-paragraph) で
                              -- cell 実行できる。"markdown" だと ```python fence を巻き込む懸念があるため hydrogen。
        output_extension = "auto",
        force_ft = nil,
      })

      -- .ipynb 開時に自動で MoltenInit を呼んで kernel 選択 popup を出す。
      -- 同一 buffer での再呼出は buffer-local 変数で抑止 (重複 init 防止)。
      -- molten plugin が lazy load なので少し defer する。
      vim.api.nvim_create_autocmd("BufWinEnter", {
        pattern = "*.ipynb",
        group = vim.api.nvim_create_augroup("molten_auto_init_ipynb", { clear = true }),
        callback = function(args)
          if vim.b[args.buf].molten_initialized then return end
          vim.b[args.buf].molten_initialized = true
          vim.defer_fn(function()
            pcall(vim.cmd, "MoltenInit")
          end, 150)
        end,
      })
    end,
  },
}
