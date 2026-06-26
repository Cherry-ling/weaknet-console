#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node)"
ADB_BIN="$(command -v adb || true)"
PORT_VALUE="${PORT:-8123}"
BIND_HOST_VALUE="${WEAKNET_HOST:-127.0.0.1}"

if [ -z "$NODE_BIN" ]; then
  echo "未找到 node，请先安装 Node.js。"
  exit 1
fi

if lsof -nP -iTCP:"$PORT_VALUE" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT_VALUE 已被占用。"
  echo "请先停止旧的 weaknet-console Agent，再重新运行本脚本。"
  echo ""
  lsof -nP -iTCP:"$PORT_VALUE" -sTCP:LISTEN
  echo ""
  read "unused?按回车退出..."
  exit 1
fi

echo "将以管理员权限启动 weaknet-console Agent。"
echo "macOS 会要求输入一次本机登录密码；之后页面按钮会自动执行弱网下发/清除。"
echo ""

if [ -n "$ADB_BIN" ]; then
  exec sudo HOST="$BIND_HOST_VALUE" PORT="$PORT_VALUE" ADB="$ADB_BIN" "$NODE_BIN" "$SCRIPT_DIR/server.js"
fi

exec sudo HOST="$BIND_HOST_VALUE" PORT="$PORT_VALUE" "$NODE_BIN" "$SCRIPT_DIR/server.js"
