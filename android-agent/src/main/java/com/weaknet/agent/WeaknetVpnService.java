package com.weaknet.agent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import hev.sockstun.TProxyService;

import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.regex.Pattern;

public class WeaknetVpnService extends VpnService {
  public static final String ACTION_APPLY = "com.weaknet.agent.APPLY";
  public static final String ACTION_STOP = "com.weaknet.agent.STOP";
  public static final String STATUS_FILE_NAME = "status.json";

  private static final String CHANNEL_ID = "weaknet_agent";
  private static final String TAG = "WeaknetVpnService";
  private static final int NOTIFICATION_ID = 61001;
  private static final Pattern PACKAGE_PATTERN = Pattern.compile("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+");

  private ParcelFileDescriptor vpnInterface;
  private Thread packetDropThread;
  private Thread tproxyThread;
  private Thread tproxyMonitorThread;
  private volatile boolean packetDropRunning;
  private volatile boolean tproxyRunning;
  private volatile int tproxyMonitorGeneration;
  private String lastStatus = "";

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    ensureForeground("弱网代理等待控制台命令");

    String action = intent == null ? "" : intent.getAction();
    if (ACTION_STOP.equals(action)) {
      stopVpn("已由控制台停止");
      return START_NOT_STICKY;
    }

    if (ACTION_APPLY.equals(action)) {
      handleApply(intent);
      return START_STICKY;
    }

    updateStatus(false, "idle", "", "", "等待 Mac 控制台下发弱网预设；请不要在系统 VPN 设置中开启“始终开启的 VPN”。", "");
    return START_NOT_STICKY;
  }

  @Override
  public void onDestroy() {
    closeVpnInterface();
    stopForeground(true);
    if (lastStatus.isEmpty() || lastStatus.contains("\"running\":true")) {
      updateStatus(false, "normal", "", "", "服务已销毁", "");
    }
    super.onDestroy();
  }

  @Override
  public void onRevoke() {
    stopVpn("VPN 权限已被撤销");
    super.onRevoke();
  }

  @Override
  protected void dump(FileDescriptor fd, PrintWriter writer, String[] args) {
    writer.println(lastStatus.isEmpty() ? readStatusFile() : lastStatus);
  }

  private void handleApply(Intent intent) {
    Profile profile = Profile.fromIntent(intent);
    if ("normal".equals(profile.presetKey)) {
      stopVpn("已切回正常网络");
      return;
    }

    if (!isValidPackageName(profile.targetPackage)) {
      stopVpn("目标包名缺失或不合法");
      updateStatus(false, "error", profile, "目标包名缺失或不合法。", "");
      return;
    }

    if (profile.isAlwaysBlock()) {
      startBlackhole(profile);
      return;
    }

    if (profile.hasSocksEndpoint()) {
      startSocksTunnel(profile);
      return;
    }

    stopVpn("当前预设缺少 SOCKS 出口");
    updateStatus(
      false,
      "unsupported",
      profile,
      "当前预设需要 Mac 控制台提供 SOCKS 出口后才能启动。",
      ""
    );
  }

  private void startBlackhole(Profile profile) {
    closeVpnInterface();

    try {
      Builder builder = new Builder()
        .setSession("弱网代理 - " + profile.displayName)
        .setMtu(1500)
        .addAddress("10.255.0.2", 32)
        .addRoute("0.0.0.0", 0)
        .addAllowedApplication(profile.targetPackage);

      try {
        builder.addAddress("fd00:776e:6574::2", 128);
        builder.addRoute("::", 0);
      } catch (RuntimeException ignored) {
        // IPv4 blackhole is still enough for the current MVP.
      }

      vpnInterface = builder.establish();
      if (vpnInterface == null) {
        updateStatus(
          false,
          "needs_permission",
          profile,
          "尚未授权 VPN。请打开手机上的弱网代理并点击“授权 VPN 权限”。",
          ""
        );
        stopSelf();
        return;
      }

      startPacketDropper(vpnInterface);
      ensureForeground("正在对 " + profile.targetPackage + " 执行 100% 丢包");
      updateStatus(
        true,
        "blackhole",
        profile,
        "已对目标应用开启 100% 丢包。",
        ""
      );
    } catch (PackageManager.NameNotFoundException error) {
      Log.e(TAG, "Target package is not installed: " + profile.targetPackage, error);
      updateStatus(false, "error", profile, "目标应用未安装。", error.getMessage());
      stopSelf();
    } catch (Exception error) {
      Log.e(TAG, "Unable to start VPN", error);
      updateStatus(false, "error", profile, "无法启动 VPN。", error.getMessage());
      stopSelf();
    }
  }

  private void startPacketDropper(ParcelFileDescriptor descriptor) {
    packetDropRunning = true;
    packetDropThread = new Thread(new Runnable() {
      @Override
      public void run() {
        byte[] buffer = new byte[32767];
        try (FileInputStream input = new FileInputStream(descriptor.getFileDescriptor())) {
          while (packetDropRunning && input.read(buffer) >= 0) {
            // Intentionally discard every packet to simulate 100% loss.
          }
        } catch (IOException ignored) {
          // Closing the VPN descriptor interrupts the blocking read.
        }
      }
    }, "weaknet-packet-dropper");
    packetDropThread.start();
  }

  private void startSocksTunnel(final Profile profile) {
    closeVpnInterface();

    try {
      Builder builder = new Builder()
        .setSession("弱网代理 - " + profile.displayName)
        .setBlocking(false)
        .setMtu(1500)
        .addAddress("198.18.0.1", 15)
        .addRoute("0.0.0.0", 0)
        .addDnsServer("223.5.5.5")
        .addAllowedApplication(profile.targetPackage);

      vpnInterface = builder.establish();
      if (vpnInterface == null) {
        updateStatus(
          false,
          "needs_permission",
          profile,
          "尚未授权 VPN。请打开手机上的弱网代理并点击“授权 VPN 权限”。",
          ""
        );
        stopSelf();
        return;
      }

      final File configFile = writeTProxyConfig(profile);
      tproxyRunning = true;
      tproxyThread = new Thread(new Runnable() {
        @Override
        public void run() {
          try {
            TProxyService.TProxyStartService(configFile.getAbsolutePath(), vpnInterface.getFd());
          } catch (Throwable error) {
            Log.e(TAG, "tun2socks failed", error);
            tproxyRunning = false;
            updateStatus(false, "error", profile, "tun2socks 启动失败。", error.getMessage());
          }
        }
      }, "weaknet-tun2socks");
      tproxyThread.start();

      ensureForeground("正在对 " + profile.targetPackage + " 执行 " + profile.displayName);
      updateStatus(
        true,
        "socks",
        profile,
        "已通过 Mac SOCKS 出口开启弱网：" + profile.displayName + "。",
        ""
      );
      startTProxyMonitor(profile);
    } catch (PackageManager.NameNotFoundException error) {
      Log.e(TAG, "Target package is not installed: " + profile.targetPackage, error);
      updateStatus(false, "error", profile, "目标应用未安装。", error.getMessage());
      stopSelf();
    } catch (Exception error) {
      Log.e(TAG, "Unable to start tun2socks VPN", error);
      updateStatus(false, "error", profile, "无法启动 tun2socks VPN。", error.getMessage());
      stopSelf();
    }
  }

  private File writeTProxyConfig(Profile profile) throws IOException {
    File file = new File(getCacheDir(), "tproxy.conf");
    File logFile = new File(getCacheDir(), "tproxy.log");
    if (logFile.exists()) logFile.delete();
    FileOutputStream output = new FileOutputStream(file, false);
    String config =
      "misc:\n" +
        "  task-stack-size: 24576\n" +
        "  log-file: '" + escapeYaml(logFile.getAbsolutePath()) + "'\n" +
        "  log-level: debug\n" +
        "tunnel:\n" +
        "  mtu: 1500\n" +
        "socks5:\n" +
        "  port: " + profile.socksPort + "\n" +
        "  address: '" + escapeYaml(profile.socksHost) + "'\n" +
        "  udp: '" + escapeYaml(profile.socksUdpMode) + "'\n";
    output.write(config.getBytes("UTF-8"));
    output.close();
    return file;
  }

  private void startTProxyMonitor(final Profile profile) {
    final int generation = ++tproxyMonitorGeneration;
    tproxyMonitorThread = new Thread(new Runnable() {
      @Override
      public void run() {
        while (tproxyRunning && generation == tproxyMonitorGeneration) {
          updateStatus(
            true,
            "socks",
            profile,
            "已通过 Mac SOCKS 出口开启弱网：" + profile.displayName + "。",
            ""
          );
          try {
            Thread.sleep(1000);
          } catch (InterruptedException ignored) {
            return;
          }
        }
      }
    }, "weaknet-tproxy-monitor");
    tproxyMonitorThread.start();
  }

  private void stopVpn(String message) {
    closeVpnInterface();
    updateStatus(false, "normal", "", "", message, "");
    stopForeground(true);
    stopSelf();
  }

  private void closeVpnInterface() {
    packetDropRunning = false;
    tproxyRunning = false;
    tproxyMonitorGeneration += 1;
    if (tproxyMonitorThread != null) {
      tproxyMonitorThread.interrupt();
    }
    try {
      TProxyService.TProxyStopService();
    } catch (Throwable ignored) {
    }
    if (vpnInterface != null) {
      try {
        vpnInterface.close();
      } catch (IOException ignored) {
      }
      vpnInterface = null;
    }
    packetDropThread = null;
    tproxyThread = null;
    tproxyMonitorThread = null;
  }

  private void ensureForeground(String text) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "弱网代理",
        NotificationManager.IMPORTANCE_LOW
      );
      NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (manager != null) manager.createNotificationChannel(channel);
    }

    Intent launchIntent = new Intent(this, MainActivity.class);
    PendingIntent pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
    );

    Notification.Builder builder =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(this, CHANNEL_ID)
        : new Notification.Builder(this);

    Notification notification = builder
      .setContentTitle("弱网代理")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .build();

    startForeground(NOTIFICATION_ID, notification);
  }

  private boolean isValidPackageName(String value) {
    return value != null && PACKAGE_PATTERN.matcher(value).matches();
  }

  private void updateStatus(
    boolean running,
    String mode,
    String presetKey,
    String targetPackage,
    String message,
    String error
  ) {
    updateStatus(running, mode, presetKey, "", targetPackage, "", 0, "", message, error);
  }

  private void updateStatus(
    boolean running,
    String mode,
    Profile profile,
    String message,
    String error
  ) {
    updateStatus(
      running,
      mode,
      profile.presetKey,
      profile.displayName,
      profile.targetPackage,
      profile.socksHost,
      profile.socksPort,
      profile.socksUdpMode,
      message,
      error
    );
  }

  private void updateStatus(
    boolean running,
    String mode,
    String presetKey,
    String displayName,
    String targetPackage,
    String socksHost,
    int socksPort,
    String socksUdpMode,
    String message,
    String error
  ) {
    lastStatus =
      "{"
        + "\"running\":" + running + ","
        + "\"mode\":\"" + escapeJson(mode) + "\","
        + "\"presetKey\":\"" + escapeJson(presetKey) + "\","
        + "\"displayName\":\"" + escapeJson(displayName) + "\","
        + "\"targetPackage\":\"" + escapeJson(targetPackage) + "\","
        + "\"socksHost\":\"" + escapeJson(socksHost) + "\","
        + "\"socksPort\":" + socksPort + ","
        + "\"socksUdpMode\":\"" + escapeJson(socksUdpMode) + "\","
        + "\"message\":\"" + escapeJson(message) + "\","
        + "\"error\":\"" + escapeJson(error) + "\","
        + "\"tproxyStats\":" + getTProxyStatsJson() + ","
        + "\"tproxyLogTail\":\"" + escapeJson(readTProxyLogTail()) + "\","
        + "\"updatedAt\":" + System.currentTimeMillis()
        + "}";
    writeStatusFile(lastStatus);
  }

  private String getTProxyStatsJson() {
    try {
      long[] stats = TProxyService.TProxyGetStats();
      if (stats == null) return "[]";
      StringBuilder builder = new StringBuilder("[");
      for (int index = 0; index < stats.length; index++) {
        if (index > 0) builder.append(",");
        builder.append(stats[index]);
      }
      builder.append("]");
      return builder.toString();
    } catch (Throwable error) {
      return "[]";
    }
  }

  private String readTProxyLogTail() {
    File file = new File(getCacheDir(), "tproxy.log");
    if (!file.exists()) return "";
    int length = (int) Math.min(file.length(), 4096);
    if (length <= 0) return "";
    try (FileInputStream input = new FileInputStream(file)) {
      long skip = Math.max(0, file.length() - length);
      while (skip > 0) {
        long skipped = input.skip(skip);
        if (skipped <= 0) break;
        skip -= skipped;
      }
      byte[] bytes = new byte[length];
      int read = input.read(bytes);
      return read <= 0 ? "" : new String(bytes, 0, read, "UTF-8");
    } catch (IOException error) {
      return error.getMessage();
    }
  }

  private void writeStatusFile(String json) {
    File file = new File(getFilesDir(), STATUS_FILE_NAME);
    try (FileOutputStream output = new FileOutputStream(file, false)) {
      output.write(json.getBytes("UTF-8"));
    } catch (IOException ignored) {
    }
  }

  private String readStatusFile() {
    File file = new File(getFilesDir(), STATUS_FILE_NAME);
    if (!file.exists()) return "{}";
    try (FileInputStream input = new FileInputStream(file)) {
      byte[] bytes = new byte[(int) file.length()];
      int read = input.read(bytes);
      return read <= 0 ? "{}" : new String(bytes, 0, read, "UTF-8");
    } catch (IOException error) {
      return "{\"error\":\"" + escapeJson(error.getMessage()) + "\"}";
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

  private static String escapeYaml(String value) {
    if (value == null) return "";
    return value.replace("'", "''");
  }

  private static class Profile {
    final String presetKey;
    final String displayName;
    final String disconnectMode;
    final double packetLossPercent;
    final Double downloadKbps;
    final Double uploadKbps;
    final String targetPackage;
    final String socksHost;
    final int socksPort;
    final String socksUdpMode;

    Profile(
      String presetKey,
      String displayName,
      String disconnectMode,
      double packetLossPercent,
      Double downloadKbps,
      Double uploadKbps,
      String targetPackage,
      String socksHost,
      int socksPort,
      String socksUdpMode
    ) {
      this.presetKey = presetKey;
      this.displayName = displayName;
      this.disconnectMode = disconnectMode;
      this.packetLossPercent = packetLossPercent;
      this.downloadKbps = downloadKbps;
      this.uploadKbps = uploadKbps;
      this.targetPackage = targetPackage;
      this.socksHost = socksHost;
      this.socksPort = socksPort;
      this.socksUdpMode = socksUdpMode == null || socksUdpMode.isEmpty() ? "udp" : socksUdpMode;
    }

    boolean isAlwaysBlock() {
      return "always".equals(disconnectMode)
        || packetLossPercent >= 100
        || isZero(downloadKbps)
        || isZero(uploadKbps);
    }

    boolean hasSocksEndpoint() {
      return socksHost != null && !socksHost.isEmpty() && socksPort > 0 && socksPort <= 65535;
    }

    static Profile fromIntent(Intent intent) {
      JSONObject json = readProfileJson(intent);
      String targetPackage = firstNonEmpty(
        intent.getStringExtra("targetPackage"),
        json.optString("targetPackage", ""),
        json.optString("targetApp", "")
      );
      return new Profile(
        firstNonEmpty(json.optString("presetKey", ""), "custom"),
        firstNonEmpty(json.optString("displayNameZh", ""), json.optString("displayName", ""), "Custom"),
        firstNonEmpty(json.optString("disconnectMode", ""), "none"),
        json.optDouble("packetLossPercent", 0),
        optionalDouble(json, "downloadKbps"),
        optionalDouble(json, "uploadKbps"),
        targetPackage,
        firstNonEmpty(json.optString("socksHost", ""), intent.getStringExtra("socksHost")),
        json.optInt("socksPort", parseInt(intent.getStringExtra("socksPort"), 0)),
        firstNonEmpty(json.optString("socksUdpMode", ""), "udp")
      );
    }

    private static JSONObject readProfileJson(Intent intent) {
      String raw = intent.getStringExtra("profile");
      String base64 = intent.getStringExtra("profileBase64");
      if (base64 != null && !base64.isEmpty()) {
        try {
          raw = new String(Base64.decode(base64, Base64.NO_WRAP), "UTF-8");
        } catch (Exception ignored) {
          raw = "{}";
        }
      }
      try {
        return new JSONObject(raw == null || raw.isEmpty() ? "{}" : raw);
      } catch (Exception ignored) {
        return new JSONObject();
      }
    }

    private static Double optionalDouble(JSONObject json, String key) {
      if (!json.has(key) || json.isNull(key)) return null;
      try {
        return json.getDouble(key);
      } catch (Exception ignored) {
        return null;
      }
    }

    private static boolean isZero(Double value) {
      return value != null && value <= 0;
    }

    private static int parseInt(String value, int fallback) {
      if (value == null || value.trim().isEmpty()) return fallback;
      try {
        return Integer.parseInt(value.trim());
      } catch (Exception ignored) {
        return fallback;
      }
    }

    private static String firstNonEmpty(String... values) {
      for (String value : values) {
        if (value != null && !value.trim().isEmpty()) return value.trim();
      }
      return "";
    }
  }
}
