using System.Runtime.InteropServices;

namespace Weaknet.WinDivertShaper;

internal enum WinDivertLayer
{
    Network = 0,
    NetworkForward = 1
}

internal enum WinDivertParam
{
    QueueLength = 0,
    QueueTime = 1,
    QueueSize = 2
}

internal enum WinDivertShutdownMode
{
    Recv = 0x1,
    Send = 0x2,
    Both = 0x3
}

internal static class WinDivertNative
{
    public const int AddressSize = 128;
    private static readonly IntPtr InvalidHandle = new(-1);

    [DllImport("WinDivert.dll", CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi, SetLastError = true)]
    private static extern IntPtr WinDivertOpen(string filter, WinDivertLayer layer, short priority, ulong flags);

    [DllImport("WinDivert.dll", CallingConvention = CallingConvention.Cdecl, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool WinDivertRecv(IntPtr handle, byte[] packet, uint packetLen, out uint recvLen, byte[] address);

    [DllImport("WinDivert.dll", CallingConvention = CallingConvention.Cdecl, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool WinDivertSend(IntPtr handle, byte[] packet, uint packetLen, out uint sendLen, byte[] address);

    [DllImport("WinDivert.dll", CallingConvention = CallingConvention.Cdecl, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool WinDivertSetParam(IntPtr handle, WinDivertParam param, ulong value);

    [DllImport("WinDivert.dll", CallingConvention = CallingConvention.Cdecl, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool WinDivertShutdown(IntPtr handle, WinDivertShutdownMode how);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    public static IntPtr Open(string filter, WinDivertLayer layer, short priority)
    {
        var handle = WinDivertOpen(filter, layer, priority, 0);
        if (handle == IntPtr.Zero || handle == InvalidHandle)
        {
            throw new WinDivertException($"WinDivertOpen failed: {DescribeLastError()}");
        }

        return handle;
    }

    public static bool Recv(IntPtr handle, byte[] packet, out int recvLen, byte[] address, out string error)
    {
        var ok = WinDivertRecv(handle, packet, (uint)packet.Length, out var nativeLen, address);
        recvLen = (int)nativeLen;
        error = ok ? "" : DescribeLastError();
        return ok;
    }

    public static bool Send(IntPtr handle, byte[] packet, int packetLen, byte[] address, out string error)
    {
        var ok = WinDivertSend(handle, packet, (uint)packetLen, out _, address);
        error = ok ? "" : DescribeLastError();
        return ok;
    }

    public static string SetQueueOptions(IntPtr handle, QueueOptions options)
    {
        var failures = new List<string>();
        SetParam(handle, WinDivertParam.QueueLength, (ulong)options.WinDivertQueueLength, failures);
        SetParam(handle, WinDivertParam.QueueSize, (ulong)options.WinDivertQueueSizeBytes, failures);
        SetParam(handle, WinDivertParam.QueueTime, (ulong)options.WinDivertQueueTimeMs, failures);
        return string.Join("; ", failures);
    }

    public static void ShutdownAndClose(IntPtr handle)
    {
        if (handle == IntPtr.Zero || handle == InvalidHandle)
        {
            return;
        }

        _ = WinDivertShutdown(handle, WinDivertShutdownMode.Both);
        _ = CloseHandle(handle);
    }

    private static void SetParam(IntPtr handle, WinDivertParam param, ulong value, List<string> failures)
    {
        if (!WinDivertSetParam(handle, param, value))
        {
            failures.Add($"{param}: {DescribeLastError()}");
        }
    }

    private static string DescribeLastError()
    {
        var code = Marshal.GetLastWin32Error();
        var message = code switch
        {
            2 => "WinDivert.dll or WinDivert driver was not found",
            5 => "administrator privileges are required",
            87 => "a WinDivert parameter value is invalid",
            577 => "the WinDivert driver signature could not be verified",
            654 => "the WinDivert driver version does not match WinDivert.dll",
            1060 => "the WinDivert driver is not installed",
            1275 => "the WinDivert driver was blocked by policy or security software",
            _ => "Win32 error"
        };

        return $"{message} ({code})";
    }
}

internal sealed class WinDivertException : Exception
{
    public WinDivertException(string message) : base(message)
    {
    }
}
