using System.Diagnostics;
using System.Text.Json;

namespace Weaknet.WinDivertShaper;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length == 0 || args[0] is "-h" or "--help" or "help")
            {
                PrintHelp();
                return 0;
            }

            var command = args[0].Trim().ToLowerInvariant();
            var options = ParseOptions(args.Skip(1).ToArray());
            return command switch
            {
                "validate" => Validate(options),
                "run" => await RunAsync(options).ConfigureAwait(false),
                _ => Fail($"Unknown command: {command}")
            };
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static int Validate(Dictionary<string, string> options)
    {
        var config = WeaknetConfig.Load(Required(options, "config"));
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            ok = true,
            config.Mode,
            ruleCount = config.Rules.Count,
            config.Profile
        }, JsonOptions.Write));
        return 0;
    }

    private static async Task<int> RunAsync(Dictionary<string, string> options)
    {
        var configPath = Required(options, "config");
        var statusPath = options.GetValueOrDefault("status");
        var pidPath = options.GetValueOrDefault("pid");
        var config = WeaknetConfig.Load(configPath);
        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cts.Cancel();
        };

        if (!string.IsNullOrWhiteSpace(pidPath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(pidPath)) ?? ".");
            await File.WriteAllTextAsync(pidPath, Environment.ProcessId.ToString(), cts.Token).ConfigureAwait(false);
        }

        var runtime = new ProfileRuntime(config.Profile);
        var waveTask = runtime.StartAsync(cts.Token);
        var workers = config.Rules.Select(rule => new WinDivertRuleWorker(rule, config.Queue, runtime, cts.Token)).ToList();

        try
        {
            foreach (var worker in workers)
            {
                worker.Start();
            }

            var statusTask = WriteStatusLoopAsync(config, runtime, workers, statusPath, cts.Token);
            Console.WriteLine($"Weaknet Windows shaper running: mode={config.Mode}, rules={workers.Count}, pid={Environment.ProcessId}");
            while (!cts.IsCancellationRequested)
            {
                await Task.Delay(500, cts.Token).ConfigureAwait(false);
            }

            await statusTask.ConfigureAwait(false);
            await waveTask.ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            foreach (var worker in workers)
            {
                worker.Dispose();
            }

            if (!string.IsNullOrWhiteSpace(statusPath))
            {
                await WriteStatusAsync(config, runtime, workers, statusPath, true, []).ConfigureAwait(false);
            }
        }

        return 0;
    }

    private static async Task WriteStatusLoopAsync(
        WeaknetConfig config,
        ProfileRuntime runtime,
        IReadOnlyCollection<WinDivertRuleWorker> workers,
        string? statusPath,
        CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(statusPath))
        {
            return;
        }

        while (!token.IsCancellationRequested)
        {
            await WriteStatusAsync(config, runtime, workers, statusPath, true, []).ConfigureAwait(false);
            await Task.Delay(Math.Max(250, config.StatusIntervalMs), token).ConfigureAwait(false);
        }
    }

    private static async Task WriteStatusAsync(
        WeaknetConfig config,
        ProfileRuntime runtime,
        IReadOnlyCollection<WinDivertRuleWorker> workers,
        string statusPath,
        bool ok,
        string[] errors)
    {
        var fullPath = Path.GetFullPath(statusPath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath) ?? ".");
        var snapshot = new StatusSnapshot
        {
            Ok = ok,
            Mode = config.Mode,
            ProcessId = Environment.ProcessId,
            UpdatedAt = DateTimeOffset.UtcNow,
            Profile = runtime.Current,
            Rules = workers.ToDictionary(worker => worker.Name, worker => worker.Snapshot()),
            Errors = errors
        };
        var tempPath = fullPath + ".tmp";
        await File.WriteAllTextAsync(tempPath, JsonSerializer.Serialize(snapshot, JsonOptions.Write)).ConfigureAwait(false);
        File.Move(tempPath, fullPath, true);
    }

    private static Dictionary<string, string> ParseOptions(string[] args)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < args.Length; index += 1)
        {
            var key = args[index];
            if (!key.StartsWith("--", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Unexpected argument: {key}");
            }

            key = key[2..];
            if (index + 1 >= args.Length || args[index + 1].StartsWith("--", StringComparison.Ordinal))
            {
                result[key] = "true";
                continue;
            }

            result[key] = args[index + 1];
            index += 1;
        }

        return result;
    }

    private static string Required(Dictionary<string, string> options, string key)
    {
        if (!options.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Missing required option: --{key}");
        }

        return value;
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine(message);
        PrintHelp();
        return 1;
    }

    private static void PrintHelp()
    {
        Console.WriteLine("""
        Weaknet.WinDivertShaper

        Commands:
          validate --config <path>
          run      --config <path> [--status <path>] [--pid <path>]

        The executable must run on Windows with Administrator privileges and WinDivert.dll
        next to the executable or on PATH.
        """);
    }
}
