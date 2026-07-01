use scripting additions

property fallbackToolDir : "/Users/lingkunwang/Desktop/Tool/weaknet-console"
property launcherHost : "127.0.0.1"
property launcherPort : "8122"

on run
	set progress total steps to 5
	set progress completed steps to 0
	set progress description to "正在启动弱网控制台"
	set progress additional description to "定位工具目录..."
	
	set toolDir to my resolveToolDir()
	if not my fileExists(toolDir & "/launcher.js") then
		display alert "无法找到弱网工具目录" message "请确认 weaknet-console 仍在：" & return & toolDir as critical
		return
	end if
	set runtimeWarnings to my ensureMacRuntimePacks(toolDir)
	
	set progress completed steps to 1
	set progress additional description to "检查 Node.js 环境..."
	set nodeBin to my findNode(toolDir)
	if nodeBin starts with "__WEAKNET_NODE_ERROR__" then
		set nodeMessage to text ((length of "__WEAKNET_NODE_ERROR__") + 1) thru -1 of nodeBin
		display alert "内置 Node.js 准备失败" message nodeMessage & return & return & "请确认 vendor-packs 内的 macOS Node 压缩包完整，或安装系统 Node.js 后重试。" as critical
		return
	end if
	if nodeBin is "" then
		display alert "未找到 Node.js" message "请先安装 Node.js，或确认 nvm/Homebrew 的 node 可用。" as critical
		return
	end if
	if runtimeWarnings is not "" then
		display alert "内置 Android 工具准备失败" message runtimeWarnings & return & return & "控制台会继续启动，但 Android VPN 功能可能不可用。" as warning
	end if
	
	set progress completed steps to 2
	set progress additional description to "启动本地 Launcher..."
	my startLauncher(toolDir, nodeBin)
	
	set progress completed steps to 3
	set progress additional description to "等待 Launcher 就绪..."
	if not my waitForLauncher() then
		display alert "Launcher 启动失败" message "请查看日志：" & return & "/tmp/weaknet-console-launcher.log" as critical
		return
	end if
	
	set progress completed steps to 4
	set progress additional description to "打开授权启动页..."
	open location ("http://" & launcherHost & ":" & launcherPort & "/")
	
	set progress completed steps to 5
	delay 0.25
end run

on resolveToolDir()
	try
		set appPath to POSIX path of (path to me)
		set appParent to do shell script "p=" & quoted form of appPath & "; p=${p%/}; /usr/bin/dirname \"$p\""
		if my fileExists(appParent & "/launcher.js") then return appParent
	end try
	return fallbackToolDir
end resolveToolDir

on fileExists(posixPath)
	try
		do shell script "/bin/test -e " & quoted form of posixPath
		return true
	on error
		return false
	end try
end fileExists

on ensureMacRuntimePacks(toolDir)
	set scriptText to "
	set +e
	tool_dir=" & quoted form of toolDir & "
	adb_target=\"$tool_dir/third_party/android/platform-tools-darwin\"
	adb_key=\"$adb_target/platform-tools/adb\"
	adb_pack=\"$tool_dir/vendor-packs/android-platform-tools-darwin.zip\"
	if [ -x \"$adb_key\" ] && ! \"$adb_key\" version >/dev/null 2>&1; then
	  /bin/rm -f \"$adb_key\"
	fi
	if [ ! -x \"$adb_key\" ] && [ -f \"$adb_pack\" ]; then
	  /bin/mkdir -p \"$adb_target\"
	  unzip_out=\"$(/usr/bin/unzip -oq \"$adb_pack\" -d \"$adb_target\" 2>&1)\"
	  unzip_status=$?
	  /bin/chmod +x \"$adb_key\" 2>/dev/null || true
	  if [ $unzip_status -ne 0 ] || [ ! -x \"$adb_key\" ]; then
	    printf '内置 adb 解压失败：%s' \"$adb_pack\"
	    if [ -n \"$unzip_out\" ]; then printf '\n%s' \"$unzip_out\"; fi
	  fi
	elif [ ! -x \"$adb_key\" ] && [ ! -f \"$adb_pack\" ]; then
	  printf '缺少内置 adb 包：%s' \"$adb_pack\"
	fi
	"
	try
		return do shell script "/bin/zsh -lc " & quoted form of scriptText
	on error errorMessage
		return errorMessage
	end try
end ensureMacRuntimePacks

on findNode(toolDir)
	set scriptText to "
	set +e
	tool_dir=" & quoted form of toolDir & "
	arch=\"$(/usr/bin/uname -m)\"
	node_issue=\"\"
	case \"$arch\" in
	  arm64) node_target=\"$tool_dir/third_party/node/darwin-arm64\"; node_pack=\"$tool_dir/vendor-packs/node-darwin-arm64-runtime.zip\" ;;
	  x86_64) node_target=\"$tool_dir/third_party/node/darwin-x64\"; node_pack=\"$tool_dir/vendor-packs/node-darwin-x64-runtime.zip\" ;;
  *) node_target=\"\"; node_pack=\"\" ;;
esac
	if [ -n \"$node_target\" ]; then
	  node_key=\"$node_target/bin/node\"
	  if [ -x \"$node_key\" ] && ! \"$node_key\" --version >/dev/null 2>&1; then
	    /bin/rm -f \"$node_key\"
	  fi
	  if [ ! -x \"$node_key\" ] && [ -f \"$node_pack\" ]; then
	    /bin/mkdir -p \"$node_target\"
	    unzip_out=\"$(/usr/bin/unzip -oq \"$node_pack\" -d \"$node_target\" 2>&1)\"
	    unzip_status=$?
	    /bin/chmod +x \"$node_key\" 2>/dev/null || true
	    if [ $unzip_status -ne 0 ] || [ ! -x \"$node_key\" ]; then
	      node_issue=\"内置 Node.js 解压失败：$node_pack\"
	      if [ -n \"$unzip_out\" ]; then node_issue=\"$node_issue
$unzip_out\"; fi
	    fi
	  elif [ ! -x \"$node_key\" ] && [ ! -f \"$node_pack\" ]; then
	    node_issue=\"缺少当前架构的内置 Node.js 包：$node_pack\"
	  fi
	  if [ -x \"$node_key\" ]; then
	    printf '%s' \"$node_key\"
    exit 0
  fi
fi
export PATH=\"/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH\"
node_bin=\"$(command -v node || true)\"
if [ -z \"$node_bin\" ] && [ -d \"$HOME/.nvm/versions/node\" ]; then
  node_bin=\"$(find \"$HOME/.nvm/versions/node\" -path '*/bin/node' -type f 2>/dev/null | sort | tail -1 || true)\"
fi
	if [ -n \"$node_bin\" ]; then
	  printf '%s' \"$node_bin\"
	elif [ -n \"$node_issue\" ]; then
	  printf '__WEAKNET_NODE_ERROR__%s' \"$node_issue\"
	fi
	"
	try
		return do shell script "/bin/zsh -lc " & quoted form of scriptText
	on error
		return ""
	end try
end findNode

on startLauncher(toolDir, nodeBin)
	set scriptText to "
set -e
tool_dir=" & quoted form of toolDir & "
node_bin=" & quoted form of nodeBin & "
port=" & quoted form of launcherPort & "
if ! /usr/sbin/lsof -nP -iTCP:\"$port\" -sTCP:LISTEN >/dev/null 2>&1; then
  cd \"$tool_dir\"
  /usr/bin/nohup \"$node_bin\" \"$tool_dir/launcher.js\" > /tmp/weaknet-console-launcher.log 2>&1 &
fi
"
	do shell script "/bin/zsh -lc " & quoted form of scriptText
end startLauncher

on waitForLauncher()
	set scriptText to "
set +e
for i in {1..40}; do
  /usr/bin/curl -fsS --max-time 1 http://" & launcherHost & ":" & launcherPort & "/api/launcher/status >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    exit 0
  fi
  sleep 0.2
done
exit 1
"
	try
		do shell script "/bin/zsh -lc " & quoted form of scriptText
		return true
	on error
		return false
	end try
end waitForLauncher
