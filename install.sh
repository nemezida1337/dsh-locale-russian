#!/bin/sh
# Install the local GigaAM v3 engine used by the voice input of dsh-locale-russian.
# Downloads the gigastt CLI (macOS arm64 release) and the INT8 e2e_rnnt model.
set -eu

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
BIN_DIR="$DSH_HOME/bin"
MODEL_DIR="${GIGASTT_MODEL_DIR:-$HOME/.gigastt/models}"
GIGASTT_VERSION="${GIGASTT_VERSION:-2.22.0}"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) ASSET="gigastt-${GIGASTT_VERSION}-aarch64-apple-darwin.tar.gz" ;;
  *)
    echo "Unsupported platform for this script: $(uname -s)-$(uname -m)" >&2
    echo "Download a gigastt release manually: https://github.com/ekhodzitsky/gigastt/releases" >&2
    exit 1
    ;;
esac

mkdir -p "$BIN_DIR" "$MODEL_DIR"

if [ ! -x "$BIN_DIR/gigastt" ]; then
  echo "Downloading gigastt $GIGASTT_VERSION..."
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL -o "$tmp/gigastt.tar.gz" \
    "https://github.com/ekhodzitsky/gigastt/releases/download/v${GIGASTT_VERSION}/${ASSET}"
  tar -xzf "$tmp/gigastt.tar.gz" -C "$tmp" gigastt
  install -m 0755 "$tmp/gigastt" "$BIN_DIR/gigastt"
fi
echo "gigastt: $("$BIN_DIR/gigastt" --version)"

echo "Preparing the GigaAM v3 e2e_rnnt INT8 model in $MODEL_DIR..."
"$BIN_DIR/gigastt" download --model-variant e2e_rnnt --model-dir "$MODEL_DIR"

echo
echo "Done. If the pack is already installed, just restart DSH."
echo "  dsh plugin --profile web add $(cd "$(dirname "$0")" && pwd)" 
