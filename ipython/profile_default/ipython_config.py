# IPython / Jupyter kernel 既定設定 (managed by dotfile/init.sh)
#
# 用途:
#   - molten-nvim + image.nvim 構成で matplotlib inline 図の解像度を底上げするため
#     `figure.dpi` と `savefig.dpi` を 150 に。Jupyter notebook 直接利用時にも適用される。
#   - afk2777 dotfile 準拠の image.nvim 構成 (max 500 cap + percentage = math.huge) と
#     組み合わせて、元画像を downscale させて sharp に表示する。
#
# 適用範囲: 現 user の全 IPython 起動 (= Jupyter kernel 全般 / molten 全般 / 通常 ipython REPL)。
#   matplotlib のスクリプト実行 (`python foo.py` で `plt.savefig`) には影響しない (InlineBackend のみ)。

c = get_config()  # noqa

c.InlineBackend.rc = {
    "figure.dpi": 150,
    "savefig.dpi": 150,
    "figure.figsize": (3, 3),
}
