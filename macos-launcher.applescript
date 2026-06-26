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
	
	set progress completed steps to 1
	set progress additional description to "检查 Node.js 环境..."
	set nodeBin to my findNode()
	if nodeBin is "" then
		display alert "未找到 Node.js" message "请先安装 Node.js，或确认 nvm/Homebrew 的 node 可用。" as critical
		return
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

on findNode()
	set scriptText to "
set -e
export PATH=\"/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH\"
node_bin=\"$(command -v node || true)\"
if [ -z \"$node_bin\" ] && [ -d \"$HOME/.nvm/versions/node\" ]; then
  node_bin=\"$(find \"$HOME/.nvm/versions/node\" -path '*/bin/node' -type f 2>/dev/null | sort | tail -1 || true)\"
fi
if [ -n \"$node_bin\" ]; then
  printf '%s' \"$node_bin\"
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
