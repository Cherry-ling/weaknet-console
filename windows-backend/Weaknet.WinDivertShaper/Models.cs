using System.Text.Json;
using System.Text.Json.Serialization;

namespace Weaknet.WinDivertShaper;

internal sealed class WeaknetConfig
{
    public string Mode { get; set; } = "win32-custom";
    public WeaknetProfile Profile { get; set; } = new();
    public List<WeaknetRule> Rules { get; set; } = new();
    public QueueOptions Queue { get; set; } = new();
    public int StatusIntervalMs { get; set; } = 1000;

    public static WeaknetConfig Load(string path)
    {
        var json = File.ReadAllText(path);
        var config = JsonSerializer.Deserialize<WeaknetConfig>(json, JsonOptions.Read);
        if (config is null)
        {
            throw new InvalidOperationException("Config JSON is empty or invalid.");
        }

        config.Validate();
        return config;
    }

    public void Validate()
    {
        if (Rules.Count == 0)
        {
            throw new InvalidOperationException("Config must contain at least one WinDivert rule.");
        }

        for (var index = 0; index < Rules.Count; index += 1)
        {
            var rule = Rules[index];
            rule.Name = string.IsNullOrWhiteSpace(rule.Name) ? $"rule-{index + 1}" : rule.Name.Trim();
            rule.Filter = string.IsNullOrWhiteSpace(rule.Filter) ? "true" : rule.Filter.Trim();
            rule.Direction = NormalizeDirection(rule.Direction);
            rule.Layer = NormalizeLayer(rule.Layer);
        }

        Queue.Normalize();
        Profile.Normalize();
    }

    private static string NormalizeDirection(string? value)
    {
        var direction = (value ?? "download").Trim().ToLowerInvariant();
        return direction switch
        {
            "up" or "upload" or "uplink" => "upload",
            "down" or "download" or "downlink" => "download",
            _ => throw new InvalidOperationException($"Unsupported rule direction: {value}")
        };
    }

    private static string NormalizeLayer(string? value)
    {
        var layer = (value ?? "network").Trim().ToLowerInvariant();
        return layer switch
        {
            "network" => "network",
            "network-forward" or "forward" => "network-forward",
            _ => throw new InvalidOperationException($"Unsupported WinDivert layer: {value}")
        };
    }
}

internal sealed class WeaknetRule
{
    public string Name { get; set; } = "";
    public string Filter { get; set; } = "true";
    public string Direction { get; set; } = "download";
    public string Layer { get; set; } = "network";
    public short Priority { get; set; } = 0;
}

internal sealed class QueueOptions
{
    public int MaxPacketSize { get; set; } = 65535;
    public int WinDivertQueueLength { get; set; } = 8192;
    public int WinDivertQueueSizeBytes { get; set; } = 32 * 1024 * 1024;
    public int WinDivertQueueTimeMs { get; set; } = 16000;

    public void Normalize()
    {
        MaxPacketSize = Math.Clamp(MaxPacketSize, 1500, 262144);
        WinDivertQueueLength = Math.Clamp(WinDivertQueueLength, 128, 65535);
        WinDivertQueueSizeBytes = Math.Clamp(WinDivertQueueSizeBytes, 1024 * 1024, 32 * 1024 * 1024);
        WinDivertQueueTimeMs = Math.Clamp(WinDivertQueueTimeMs, 256, 16000);
    }
}

internal sealed class WeaknetProfile
{
    public string PresetKey { get; set; } = "custom";
    public string DisplayNameZh { get; set; } = "Windows weaknet";
    public double? LatencyRttMs { get; set; }
    public double? PipeDelayMs { get; set; }
    public double JitterMs { get; set; }
    public double PacketLossPercent { get; set; }
    public double? DownloadKbps { get; set; }
    public double? UploadKbps { get; set; }
    public string DisconnectMode { get; set; } = "none";
    public double DisconnectDurationSec { get; set; }
    public double DisconnectIntervalSec { get; set; }
    public NetworkWaveOptions NetworkWave { get; set; } = new();

    public void Normalize()
    {
        LatencyRttMs = ClampNullable(LatencyRttMs, 0, 10000);
        PipeDelayMs = ClampNullable(PipeDelayMs, 0, 10000);
        JitterMs = Math.Clamp(JitterMs, 0, 10000);
        PacketLossPercent = Math.Clamp(PacketLossPercent, 0, 100);
        DownloadKbps = ClampNullable(DownloadKbps, 0, 10000000);
        UploadKbps = ClampNullable(UploadKbps, 0, 10000000);
        DisconnectDurationSec = Math.Clamp(DisconnectDurationSec, 0, 3600);
        DisconnectIntervalSec = Math.Clamp(DisconnectIntervalSec, 0, 3600);
        DisconnectMode = InferDisconnectMode().ToLowerInvariant();
    }

    public WeaknetProfile Clone()
    {
        return new WeaknetProfile
        {
            PresetKey = PresetKey,
            DisplayNameZh = DisplayNameZh,
            LatencyRttMs = LatencyRttMs,
            PipeDelayMs = PipeDelayMs,
            JitterMs = JitterMs,
            PacketLossPercent = PacketLossPercent,
            DownloadKbps = DownloadKbps,
            UploadKbps = UploadKbps,
            DisconnectMode = DisconnectMode,
            DisconnectDurationSec = DisconnectDurationSec,
            DisconnectIntervalSec = DisconnectIntervalSec,
            NetworkWave = NetworkWave.Clone()
        };
    }

    private string InferDisconnectMode()
    {
        if (PresetKey == "normal")
        {
            return "none";
        }

        if (DisconnectMode == "always" || PacketLossPercent >= 100 || DownloadKbps == 0 || UploadKbps == 0)
        {
            return "always";
        }

        if (DisconnectMode == "periodic" || (DisconnectDurationSec > 0 && DisconnectIntervalSec > 0))
        {
            return "periodic";
        }

        return "none";
    }

    private static double? ClampNullable(double? value, double min, double max)
    {
        if (value is null)
        {
            return null;
        }

        if (double.IsNaN(value.Value) || double.IsInfinity(value.Value))
        {
            return null;
        }

        return Math.Clamp(value.Value, min, max);
    }
}

internal sealed class NetworkWaveOptions
{
    public bool Enabled { get; set; }
    public string Mode { get; set; } = "subway-elevator";

    public NetworkWaveOptions Clone()
    {
        return new NetworkWaveOptions
        {
            Enabled = Enabled,
            Mode = Mode
        };
    }
}

internal sealed class StatusSnapshot
{
    public bool Ok { get; set; }
    public string Mode { get; set; } = "";
    public int ProcessId { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public WeaknetProfile Profile { get; set; } = new();
    public Dictionary<string, RuleStatsSnapshot> Rules { get; set; } = new();
    public string[] Errors { get; set; } = [];
}

internal static class JsonOptions
{
    public static readonly JsonSerializerOptions Read = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static readonly JsonSerializerOptions Write = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };
}
