#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node)"
LAUNCHER_PORT_VALUE="${LAUNCHER_PORT:-8122}"
LAUNCHER_HOST_VALUE="${LAUNCHER_HOST:-127.0.0.1}"

if [ -z "$NODE_BIN" ]; then
  echo "未找到 node，请先安装 Node.js。"
  read "unused?按回车退出..."
  exit 1
fi

if ! lsof -nP -iTCP:"$LAUNCHER_PORT_VALUE" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "启动弱网工具 Launcher..."
  nohup "$NODE_BIN" "$SCRIPT_DIR/launcher.js" > /tmp/weaknet-console-launcher.log 2>&1 &
  sleep 0.8
fi

open "http://$LAUNCHER_HOST_VALUE:$LAUNCHER_PORT_VALUE/"
echo "弱网工具启动页已打开： http://$LAUNCHER_HOST_VALUE:$LAUNCHER_PORT_VALUE/"
