package com.weaknet.agent;

import android.os.ParcelFileDescriptor;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;

import java.io.Closeable;
import java.io.FileDescriptor;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.util.concurrent.atomic.AtomicLong;

class TunPacketShaper {
  interface Listener {
    void onError(String message);
  }

  static class Config {
    String displayName = "Local";
    String disconnectMode = "none";
    double packetLossPercent;
    Double downloadKbps;
    Double uploadKbps;
    Double latencyRttMs;
    double jitterMs;
    int disconnectDurationSec;
    int disconnectIntervalSec;
  }

  static class Stats {
    final AtomicLong uploadPackets = new AtomicLong();
    final AtomicLong downloadPackets = new AtomicLong();
    final AtomicLong uploadBytes = new AtomicLong();
    final AtomicLong downloadBytes = new AtomicLong();
    final AtomicLong droppedPackets = new AtomicLong();
    final AtomicLong blockedPackets = new AtomicLong();
    final AtomicLong delayedPackets = new AtomicLong();
    volatile String lastError = "";

    String toJson() {
      return "{"
        + "\"uploadPackets\":" + uploadPackets.get() + ","
        + "\"downloadPackets\":" + downloadPackets.get() + ","
        + "\"uploadBytes\":" + uploadBytes.get() + ","
        + "\"downloadBytes\":" + downloadBytes.get() + ","
        + "\"droppedPackets\":" + droppedPackets.get() + ","
        + "\"blockedPackets\":" + blockedPackets.get() + ","
        + "\"delayedPackets\":" + delayedPackets.get() + ","
        + "\"lastError\":\"" + escapeJson(lastError) + "\""
        + "}";
    }
  }

  private static class DirectionShaper {
    private final Double kbps;
    private long nextAvailableAt;

    DirectionShaper(Double kbps) {
      this.kbps = kbps;
    }

    synchronized void throttle(int bytes) {
      if (kbps == null || kbps <= 0 || bytes <= 0) return;
      long now = System.currentTimeMillis();
      long waitUntil = Math.max(now, nextAvailableAt);
      long durationMs = Math.max(1L, Math.round((bytes * 8.0d) / kbps));
      nextAvailableAt = waitUntil + durationMs;
      sleepQuietly(Math.max(0L, waitUntil - now));
    }
  }

  private final ParcelFileDescriptor vpnInterface;
  private final ParcelFileDescriptor tproxyInterface;
  private final ParcelFileDescriptor shaperInterface;
  private final Config config;
  private final Listener listener;
  private final Stats stats = new Stats();
  private final DirectionShaper uploadShaper;
  private final DirectionShaper downloadShaper;
  private volatile boolean running;
  private Thread uploadThread;
  private Thread downloadThread;
  private long startedAt;

  TunPacketShaper(ParcelFileDescriptor vpnInterface, Config config, Listener listener) throws IOException {
    this.vpnInterface = vpnInterface;
    this.config = config;
    this.listener = listener;
    this.uploadShaper = new DirectionShaper(config.uploadKbps);
    this.downloadShaper = new DirectionShaper(config.downloadKbps);

    FileDescriptor tproxyFd = new FileDescriptor();
    FileDescriptor shaperFd = new FileDescriptor();
    try {
      Os.socketpair(OsConstants.AF_UNIX, OsConstants.SOCK_DGRAM, 0, tproxyFd, shaperFd);
      this.tproxyInterface = ParcelFileDescriptor.dup(tproxyFd);
      this.shaperInterface = ParcelFileDescriptor.dup(shaperFd);
    } catch (ErrnoException error) {
      throw new IOException("Unable to create TUN shaper socket pair: " + error.getMessage(), error);
    } finally {
      closeRaw(tproxyFd);
      closeRaw(shaperFd);
    }
  }

  int getTproxyFd() {
    return tproxyInterface.getFd();
  }

  Stats getStats() {
    return stats;
  }

  void start() {
    running = true;
    startedAt = System.currentTimeMillis();
    uploadThread = pipe(
      vpnInterface.getFileDescriptor(),
      shaperInterface.getFileDescriptor(),
      true,
      "weaknet-tun-upload"
    );
    downloadThread = pipe(
      shaperInterface.getFileDescriptor(),
      vpnInterface.getFileDescriptor(),
      false,
      "weaknet-tun-download"
    );
    uploadThread.start();
    downloadThread.start();
  }

  void stop() {
    running = false;
    closeQuietly(tproxyInterface);
    closeQuietly(shaperInterface);
    if (uploadThread != null) uploadThread.interrupt();
    if (downloadThread != null) downloadThread.interrupt();
  }

  private Thread pipe(final FileDescriptor input, final FileDescriptor output, final boolean upload, String name) {
    return new Thread(new Runnable() {
      @Override
      public void run() {
        byte[] buffer = new byte[65535];
        while (running) {
          try {
            int read = readPacket(input, buffer);
            if (read < 0) break;
            if (read == 0) continue;
            if (upload) stats.uploadPackets.incrementAndGet();
            else stats.downloadPackets.incrementAndGet();
            if (!shape(upload, read)) continue;
            writePacket(output, buffer, read);
            if (upload) stats.uploadBytes.addAndGet(read);
            else stats.downloadBytes.addAndGet(read);
          } catch (IOException error) {
            if (running) reportError(error);
            break;
          }
        }
      }
    }, name);
  }

  private int readPacket(FileDescriptor input, byte[] buffer) throws IOException {
    try {
      return Os.read(input, buffer, 0, buffer.length);
    } catch (InterruptedIOException error) {
      return 0;
    } catch (ErrnoException error) {
      if (error.errno == OsConstants.EAGAIN) {
        sleepQuietly(3L);
        return 0;
      }
      if (error.errno == OsConstants.EBADF) return -1;
      throw new IOException("TUN read failed: " + error.getMessage(), error);
    }
  }

  private void writePacket(FileDescriptor output, byte[] buffer, int length) throws IOException {
    while (running) {
      try {
        int written = Os.write(output, buffer, 0, length);
        if (written != length) throw new IOException("TUN packet write was partial: " + written + "/" + length);
        return;
      } catch (InterruptedIOException error) {
        return;
      } catch (ErrnoException error) {
        if (error.errno == OsConstants.EAGAIN) {
          sleepQuietly(3L);
          continue;
        }
        if (error.errno == OsConstants.EBADF) return;
        throw new IOException("TUN write failed: " + error.getMessage(), error);
      }
    }
  }

  private boolean shape(boolean upload, int bytes) {
    if (!running) return false;
    if (getPeriodicBlockRemainingMs() > 0) {
      stats.blockedPackets.incrementAndGet();
      stats.droppedPackets.incrementAndGet();
      return false;
    }
    if (config.packetLossPercent > 0 && Math.random() * 100.0d < config.packetLossPercent) {
      stats.droppedPackets.incrementAndGet();
      return false;
    }
    long delayMs = getDelayMs();
    if (delayMs > 0) {
      stats.delayedPackets.incrementAndGet();
      sleepQuietly(delayMs);
    }
    if (upload) uploadShaper.throttle(bytes);
    else downloadShaper.throttle(bytes);
    return running;
  }

  private long getPeriodicBlockRemainingMs() {
    if (!"periodic".equals(config.disconnectMode)) return 0L;
    if (config.disconnectDurationSec <= 0 || config.disconnectIntervalSec <= 0) return 0L;
    long intervalMs = Math.max(1L, config.disconnectIntervalSec * 1000L);
    long durationMs = Math.min(intervalMs, Math.max(1L, config.disconnectDurationSec * 1000L));
    long elapsedMs = Math.max(0L, System.currentTimeMillis() - startedAt);
    long positionMs = elapsedMs % intervalMs;
    return positionMs < durationMs ? durationMs - positionMs : 0L;
  }

  private long getDelayMs() {
    if (config.latencyRttMs == null) return 0L;
    double base = Math.max(0.0d, config.latencyRttMs / 2.0d);
    double jitter = Math.max(0.0d, config.jitterMs / 2.0d);
    if (jitter > 0) {
      base = Math.max(0.0d, base - jitter + (Math.random() * jitter * 2.0d));
    }
    return Math.round(base);
  }

  private void reportError(IOException error) {
    stats.lastError = error.getMessage();
    if (listener != null) listener.onError(error.getMessage());
  }

  private static void sleepQuietly(long ms) {
    if (ms <= 0) return;
    try {
      Thread.sleep(ms);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    }
  }

  private static void closeRaw(FileDescriptor descriptor) {
    if (descriptor == null || !descriptor.valid()) return;
    try {
      Os.close(descriptor);
    } catch (Exception ignored) {
    }
  }

  private static void closeQuietly(Closeable closeable) {
    if (closeable == null) return;
    try {
      closeable.close();
    } catch (IOException ignored) {
    }
  }

  private static String escapeJson(String value) {
    if (value == null) return "";
    return value
      .replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\n", "\\n")
      .replace("\r", "\\r");
  }
}
