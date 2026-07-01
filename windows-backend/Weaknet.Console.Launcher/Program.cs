using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace Weaknet.Console.Launcher
{
    internal static class Program
    {
        [STAThread]
        private static int Main()
        {
          try
          {
              var repoRoot = FindRepoRoot(AppDomain.CurrentDomain.BaseDirectory);
              var scriptsDir = Path.Combine(repoRoot, "windows-backend", "scripts");
              var ensureScript = Path.Combine(scriptsDir, "ensure-vendored-deps.ps1");
              var launcherScript = Path.Combine(scriptsDir, "run-weaknet-launcher.ps1");

              RunPowerShell(
                  ensureScript,
                  "-Group runtime -Quiet",
                  repoRoot,
                  "Weaknet vendored runtime initialization failed.");

              RunPowerShell(
                  launcherScript,
                  "-Port 8122 -OpenBrowser",
                  repoRoot,
                  "Weaknet launcher failed to start.");

              return 0;
          }
          catch (Exception ex)
          {
              ShowMessageBox(ex.Message, "WeakNetConsole");
              return 1;
          }
        }

        private static void ShowMessageBox(string text, string caption)
        {
            MessageBoxW(IntPtr.Zero, text, caption, 0x00000010);
        }

        private static string FindRepoRoot(string startDirectory)
        {
            var current = new DirectoryInfo(startDirectory);
            while (current != null)
            {
                var launcherJs = Path.Combine(current.FullName, "launcher.js");
                var windowsBackend = Path.Combine(current.FullName, "windows-backend");
                if (File.Exists(launcherJs) && Directory.Exists(windowsBackend))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }

            throw new InvalidOperationException("Unable to locate the weaknet repo root from the launcher executable.");
        }

        private static void RunPowerShell(string scriptPath, string extraArguments, string workingDirectory, string failurePrefix)
        {
            if (!File.Exists(scriptPath))
            {
                throw new FileNotFoundException(string.Format("Required script was not found: {0}", scriptPath));
            }

            var powerShellExe = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "System32",
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe");

            if (!File.Exists(powerShellExe))
            {
                throw new FileNotFoundException(string.Format("powershell.exe was not found: {0}", powerShellExe));
            }

            var arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\" {1}", scriptPath, extraArguments);
            var startInfo = new ProcessStartInfo
            {
                FileName = powerShellExe,
                Arguments = arguments,
                WorkingDirectory = workingDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            using (var process = Process.Start(startInfo))
            {
                if (process == null)
                {
                    throw new InvalidOperationException(string.Format("Failed to start {0}", scriptPath));
                }

                var stdOut = process.StandardOutput.ReadToEnd();
                var stdErr = process.StandardError.ReadToEnd();
                process.WaitForExit();

                if (process.ExitCode == 0)
                {
                    return;
                }

                var builder = new StringBuilder();
                builder.AppendLine(failurePrefix);
                if (!string.IsNullOrWhiteSpace(stdErr))
                {
                    builder.AppendLine();
                    builder.AppendLine(stdErr.Trim());
                }
                if (!string.IsNullOrWhiteSpace(stdOut))
                {
                    builder.AppendLine();
                    builder.AppendLine(stdOut.Trim());
                }

                throw new InvalidOperationException(builder.ToString().Trim());
            }
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
    }
}
