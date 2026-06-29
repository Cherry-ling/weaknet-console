using System.Diagnostics;

namespace Weaknet.WinDivertShaper;

internal sealed class WinDivertRuleWorker : IDisposable
{
    private readonly WeaknetRule _rule;
    private readonly QueueOptions _queueOptions;
    private readonly ProfileRuntime _profileRuntime;
    private readonly RuleStats _stats = new();
    private readonly object _queueLock = new();
    private readonly PriorityQueue<QueuedPacket, long> _sendQueue = new();
    private readonly AutoResetEvent _queueSignal = new(false);
    private readonly CancellationToken _token;
    private readonly long _startTimestamp = Stopwatch.GetTimestamp();
    private IntPtr _handle;
    private Thread? _recvThread;
    private Thread? _sendThread;
    private long _nextSendTimestamp;
    private bool _disposed;

    public WinDivertRuleWorker(WeaknetRule rule, QueueOptions queueOptions, ProfileRuntime profileRuntime, CancellationToken token)
    {
        _rule = rule;
        _queueOptions = queueOptions;
        _profileRuntime = profileRuntime;
        _token = token;
    }

    public string Name => _rule.Name;

    public RuleStatsSnapshot Snapshot()
    {
        return _stats.Snapshot(GetQueuedCount());
    }

    public void Start()
    {
        var filter = NormalizeFilter(_rule.Filter);
        _handle = WinDivertNative.Open(filter, ParseLayer(_rule.Layer), _rule.Priority);
        var queueError = WinDivertNative.SetQueueOptions(_handle, _queueOptions);
        if (!string.IsNullOrWhiteSpace(queueError))
        {
            _stats.ReportError(queueError);
        }

        _recvThread = new Thread(ReceiveLoop)
        {
            IsBackground = true,
            Name = $"weaknet-win32-recv-{_rule.Name}"
        };
        _sendThread = new Thread(SendLoop)
        {
            IsBackground = true,
            Name = $"weaknet-win32-send-{_rule.Name}"
        };

        _recvThread.Start();
        _sendThread.Start();
    }

    public void Stop()
    {
        WinDivertNative.ShutdownAndClose(_handle);
        _handle = IntPtr.Zero;
        _queueSignal.Set();
        _recvThread?.Join(TimeSpan.FromSeconds(2));
        _sendThread?.Join(TimeSpan.FromSeconds(2));
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        Stop();
        _queueSignal.Dispose();
    }

    private void ReceiveLoop()
    {
        while (!_token.IsCancellationRequested)
        {
            var packetBuffer = new byte[_queueOptions.MaxPacketSize];
            var addressBuffer = new byte[WinDivertNative.AddressSize];
            if (!WinDivertNative.Recv(_handle, packetBuffer, out var packetLen, addressBuffer, out var error))
            {
                if (!_token.IsCancellationRequested)
                {
                    _stats.ReportError(error);
                }
                continue;
            }

            var packet = new byte[packetLen];
            Buffer.BlockCopy(packetBuffer, 0, packet, 0, packetLen);
            var address = new byte[WinDivertNative.AddressSize];
            Buffer.BlockCopy(addressBuffer, 0, address, 0, WinDivertNative.AddressSize);

            _stats.Captured(packetLen);
            var profile = _profileRuntime.Current;
            var decision = Decide(profile, packetLen);
            if (decision.DropReason == DropReason.Blocked)
            {
                _stats.DroppedBlocked(packetLen);
                continue;
            }

            if (decision.DropReason == DropReason.PacketLoss)
            {
                _stats.DroppedLoss(packetLen);
                continue;
            }

            Enqueue(new QueuedPacket(packet, packetLen, address), decision.DueTimestamp);
        }
    }

    private void SendLoop()
    {
        while (!_token.IsCancellationRequested)
        {
            var next = TryDequeueReady(out var waitMs);
            if (next is null)
            {
                _queueSignal.WaitOne(waitMs);
                continue;
            }

            if (WinDivertNative.Send(_handle, next.Packet, next.Length, next.Address, out var error))
            {
                _stats.Sent(next.Length);
            }
            else if (!_token.IsCancellationRequested)
            {
                _stats.SendFailed(next.Length, error);
            }
        }
    }

    private PacketDecision Decide(WeaknetProfile profile, int packetLen)
    {
        if (_profileRuntime.IsBlocked(profile))
        {
            return PacketDecision.Drop(DropReason.Blocked);
        }

        if (profile.PacketLossPercent > 0 && Random.Shared.NextDouble() * 100 < profile.PacketLossPercent)
        {
            return PacketDecision.Drop(DropReason.PacketLoss);
        }

        var now = Stopwatch.GetTimestamp();
        var due = now + MsToTicks(ComputeDelayMs(profile));
        due = ApplyRateLimit(profile, packetLen, due);
        return PacketDecision.SendAt(due);
    }

    private double ComputeDelayMs(WeaknetProfile profile)
    {
        if (profile.PipeDelayMs is not null)
        {
            return profile.PipeDelayMs.Value;
        }

        if (profile.LatencyRttMs is null)
        {
            return 0;
        }

        var baseDelay = profile.LatencyRttMs.Value / 2.0;
        var jitter = profile.JitterMs / 2.0;
        if (jitter <= 0)
        {
            return baseDelay;
        }

        return Math.Max(0, baseDelay - jitter + Random.Shared.NextDouble() * jitter * 2.0);
    }

    private long ApplyRateLimit(WeaknetProfile profile, int packetLen, long dueTimestamp)
    {
        var rateKbps = _rule.Direction == "upload" ? profile.UploadKbps : profile.DownloadKbps;
        if (rateKbps is null || rateKbps <= 0)
        {
            return dueTimestamp;
        }

        var bytesPerSecond = Math.Max(1, rateKbps.Value * 1000.0 / 8.0);
        var transmitTicks = Math.Max(1, (long)(packetLen / bytesPerSecond * Stopwatch.Frequency));

        lock (_queueLock)
        {
            var start = Math.Max(dueTimestamp, _nextSendTimestamp == 0 ? dueTimestamp : _nextSendTimestamp);
            _nextSendTimestamp = start + transmitTicks;
            return start;
        }
    }

    private void Enqueue(QueuedPacket packet, long dueTimestamp)
    {
        lock (_queueLock)
        {
            _sendQueue.Enqueue(packet, dueTimestamp);
        }

        _queueSignal.Set();
    }

    private QueuedPacket? TryDequeueReady(out int waitMs)
    {
        lock (_queueLock)
        {
            if (_sendQueue.Count == 0)
            {
                waitMs = 250;
                return null;
            }

            _sendQueue.TryPeek(out _, out var due);
            var now = Stopwatch.GetTimestamp();
            if (due > now)
            {
                waitMs = Math.Clamp(TicksToMs(due - now), 1, 250);
                return null;
            }

            waitMs = 0;
            return _sendQueue.Dequeue();
        }
    }

    private int GetQueuedCount()
    {
        lock (_queueLock)
        {
            return _sendQueue.Count;
        }
    }

    private static string NormalizeFilter(string filter)
    {
        return $"({filter}) and not impostor";
    }

    private static WinDivertLayer ParseLayer(string layer)
    {
        return layer == "network-forward" ? WinDivertLayer.NetworkForward : WinDivertLayer.Network;
    }

    private static long MsToTicks(double ms)
    {
        return ms <= 0 ? 0 : (long)(ms * Stopwatch.Frequency / 1000.0);
    }

    private static int TicksToMs(long ticks)
    {
        return (int)Math.Ceiling(ticks * 1000.0 / Stopwatch.Frequency);
    }
}

internal sealed record QueuedPacket(byte[] Packet, int Length, byte[] Address);

internal enum DropReason
{
    None,
    PacketLoss,
    Blocked
}

internal readonly record struct PacketDecision(DropReason DropReason, long DueTimestamp)
{
    public static PacketDecision Drop(DropReason reason) => new(reason, 0);
    public static PacketDecision SendAt(long dueTimestamp) => new(DropReason.None, dueTimestamp);
}

internal sealed class RuleStats
{
    private long _capturedPackets;
    private long _sentPackets;
    private long _droppedLossPackets;
    private long _droppedBlockedPackets;
    private long _sendErrorPackets;
    private long _capturedBytes;
    private long _sentBytes;
    private long _droppedBytes;
    private string _lastError = "";

    public void Captured(int bytes)
    {
        Interlocked.Increment(ref _capturedPackets);
        Interlocked.Add(ref _capturedBytes, bytes);
    }

    public void Sent(int bytes)
    {
        Interlocked.Increment(ref _sentPackets);
        Interlocked.Add(ref _sentBytes, bytes);
    }

    public void DroppedLoss(int bytes)
    {
        Interlocked.Increment(ref _droppedLossPackets);
        Interlocked.Add(ref _droppedBytes, bytes);
    }

    public void DroppedBlocked(int bytes)
    {
        Interlocked.Increment(ref _droppedBlockedPackets);
        Interlocked.Add(ref _droppedBytes, bytes);
    }

    public void SendFailed(int bytes, string error)
    {
        Interlocked.Increment(ref _sendErrorPackets);
        Interlocked.Add(ref _droppedBytes, bytes);
        ReportError(error);
    }

    public void ReportError(string error)
    {
        if (!string.IsNullOrWhiteSpace(error))
        {
            Volatile.Write(ref _lastError, error);
        }
    }

    public RuleStatsSnapshot Snapshot(int queuedPackets)
    {
        return new RuleStatsSnapshot
        {
            CapturedPackets = Interlocked.Read(ref _capturedPackets),
            SentPackets = Interlocked.Read(ref _sentPackets),
            DroppedLossPackets = Interlocked.Read(ref _droppedLossPackets),
            DroppedBlockedPackets = Interlocked.Read(ref _droppedBlockedPackets),
            SendErrorPackets = Interlocked.Read(ref _sendErrorPackets),
            CapturedBytes = Interlocked.Read(ref _capturedBytes),
            SentBytes = Interlocked.Read(ref _sentBytes),
            DroppedBytes = Interlocked.Read(ref _droppedBytes),
            QueuedPackets = queuedPackets,
            LastError = Volatile.Read(ref _lastError)
        };
    }
}

internal sealed class RuleStatsSnapshot
{
    public long CapturedPackets { get; set; }
    public long SentPackets { get; set; }
    public long DroppedLossPackets { get; set; }
    public long DroppedBlockedPackets { get; set; }
    public long SendErrorPackets { get; set; }
    public long CapturedBytes { get; set; }
    public long SentBytes { get; set; }
    public long DroppedBytes { get; set; }
    public int QueuedPackets { get; set; }
    public string LastError { get; set; } = "";
}
