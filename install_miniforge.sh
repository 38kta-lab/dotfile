#!/usr/bin/env bash
set -euo pipefail

PREFIX="${MINIFORGE_PREFIX:-$HOME/miniforge3}"
VERSION="${MINIFORGE_VERSION:-latest}"

case "$(uname -s):$(uname -m)" in
  Darwin:arm64)
    INSTALLER="Miniforge3-MacOSX-arm64.sh"
    ;;
  Darwin:x86_64)
    INSTALLER="Miniforge3-MacOSX-x86_64.sh"
    ;;
  *)
    echo "Unsupported platform: $(uname -s) $(uname -m)" >&2
    exit 1
    ;;
esac

if [ -x "$PREFIX/bin/conda" ]; then
  echo "Miniforge already installed: $PREFIX"
  "$PREFIX/bin/conda" --version
  exit 0
fi

if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/conda-forge/miniforge/releases/latest/download/$INSTALLER"
else
  URL="https://github.com/conda-forge/miniforge/releases/download/$VERSION/$INSTALLER"
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Downloading Miniforge installer:"
echo "  $URL"
curl -L "$URL" -o "$TMP_DIR/$INSTALLER"

echo "Installing Miniforge to:"
echo "  $PREFIX"
bash "$TMP_DIR/$INSTALLER" -b -p "$PREFIX"

"$PREFIX/bin/conda" config --set auto_activate_base false

echo "Miniforge installed."
echo "Run ./init.sh or restart zsh so zsh/env.zsh can load conda shell support."
