#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ ! -x "$DIR/.venv/bin/python" ]]; then
  python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
fi
"$DIR/.venv/bin/python" "$DIR/generate_relatorio.py"
