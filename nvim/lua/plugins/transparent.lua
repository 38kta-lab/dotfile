return {
  {
    "xiyaowong/transparent.nvim",
    lazy = false,
    priority = 1000,
    init = function()
      vim.g.transparent_enabled = true
    end,
    opts = {
      extra_groups = {
        "StatusLine",
        "StatusLineNC",
        "WinBar",
        "WinBarNC",
      },
      exclude_groups = {},
    },
    config = function(_, opts)
      require("transparent").setup(opts)
      vim.cmd("TransparentEnable")
    end,
    keys = {
      { "<leader>ut", "<cmd>TransparentToggle<cr>", desc = "Toggle Transparency" },
    },
  },
}
