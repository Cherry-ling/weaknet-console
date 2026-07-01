namespace Weaknet.WinDivertShaper;

internal sealed class ProfileRuntime
{
    private static readonly NetworkWaveDefaults WaveDefaults = new();
    private readonly WeaknetProfile _baseProfile;
    private readonly DateTimeOffset _startedAt = DateTimeOffset.UtcNow;
    private readonly object _lock = new();
    private WeaknetProfile _current;

    public ProfileRuntime(WeaknetProfile profile)
    {
        _baseProfile = profile.Clone();
        _current = profile.NetworkWave.Enabled ? BuildInitialWaveProfile(profile) : profile.Clone();
    }

    public WeaknetProfile Current
    {
        get
        {
            lock (_lock)
            {
                return _current.Clone();
            }
        }
    }

    public DateTimeOffset StartedAt => _startedAt;

    public bool IsBlocked(WeaknetProfile profile)
    {
        if (profile.DisconnectMode == "always")
        {
            return true;
        }

        if (profile.DisconnectMode != "periodic" || profile.DisconnectDurationSec <= 0 || profile.DisconnectIntervalSec <= 0)
        {
            return false;
        }

        var elapsed = (DateTimeOffset.UtcNow - _startedAt).TotalSeconds;
        var position = elapsed % profile.DisconnectIntervalSec;
        return position < profile.DisconnectDurationSec;
    }

    public Task StartAsync(CancellationToken token)
    {
        if (!_baseProfile.NetworkWave.Enabled)
        {
            return Task.CompletedTask;
        }

        return Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                var delay = Random.Shared.Next(WaveDefaults.IntervalMinMs, WaveDefaults.IntervalMaxMs + 1);
                await Task.Delay(delay, token).ConfigureAwait(false);

                var next = BuildRandomWaveProfile(_baseProfile);
                lock (_lock)
                {
                    _current = next;
                }
            }
        }, token);
    }

    private static WeaknetProfile BuildInitialWaveProfile(WeaknetProfile profile)
    {
        var next = profile.Clone();
        next.DownloadKbps = 500;
        next.UploadKbps = 200;
        next.PipeDelayMs = 100;
        next.PacketLossPercent = 2;
        next.NetworkWave = new NetworkWaveOptions { Enabled = true, Mode = WaveDefaults.Mode };
        next.Normalize();
        return next;
    }

    private static WeaknetProfile BuildRandomWaveProfile(WeaknetProfile profile)
    {
        var source = Random.Shared.NextDouble() < WaveDefaults.SignalLostChance ? WaveDefaults.SignalLost : WaveDefaults.Normal;
        var next = profile.Clone();
        next.DownloadKbps = RandomInt(source.DownloadMinKbps, source.DownloadMaxKbps);
        next.UploadKbps = RandomInt(source.UploadMinKbps, source.UploadMaxKbps);
        next.PipeDelayMs = RandomInt(source.DelayMinMs, source.DelayMaxMs);
        next.PacketLossPercent = Math.Round(RandomDouble(source.PacketLossMinPercent, source.PacketLossMaxPercent), 2);
        next.NetworkWave = new NetworkWaveOptions { Enabled = true, Mode = WaveDefaults.Mode };
        next.Normalize();
        return next;
    }

    private static int RandomInt(int min, int max)
    {
        return Random.Shared.Next(min, max + 1);
    }

    private static double RandomDouble(double min, double max)
    {
        return min + Random.Shared.NextDouble() * (max - min);
    }
}

internal sealed class NetworkWaveDefaults
{
    public string Mode { get; } = "subway-elevator";
    public int IntervalMinMs { get; } = 800;
    public int IntervalMaxMs { get; } = 2000;
    public double SignalLostChance { get; } = 0.15;
    public NetworkWaveBand Normal { get; } = new(50, 3000, 20, 1000, 30, 400, 0, 5);
    public NetworkWaveBand SignalLost { get; } = new(5, 30, 2, 15, 500, 1200, 10, 30);
}

internal sealed record NetworkWaveBand(
    int DownloadMinKbps,
    int DownloadMaxKbps,
    int UploadMinKbps,
    int UploadMaxKbps,
    int DelayMinMs,
    int DelayMaxMs,
    double PacketLossMinPercent,
    double PacketLossMaxPercent);
