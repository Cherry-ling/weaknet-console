package com.weaknet.agent;

import android.net.VpnService;

import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

class LocalSocksProxy {
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

  private static class SocksRequest {
    int command;
    int atyp;
    String host;
    int port;
  }

  private static class UdpPayload {
    int atyp;
    String host;
    int port;
    byte[] payload;
    InetAddress clientAddress;
    int clientPort;
  }

  private static class ClientTarget {
    InetAddress clientAddress;
    int clientPort;

    ClientTarget(InetAddress clientAddress, int clientPort) {
      this.clientAddress = clientAddress;
      this.clientPort = clientPort;
    }
  }

  static class Stats {
    final AtomicLong tcpAccepted = new AtomicLong();
    final AtomicLong tcpActive = new AtomicLong();
    final AtomicLong tcpConnectFailed = new AtomicLong();
    final AtomicLong udpUploadPackets = new AtomicLong();
    final AtomicLong udpDownloadPackets = new AtomicLong();
    final AtomicLong uploadBytes = new AtomicLong();
    final AtomicLong downloadBytes = new AtomicLong();
    final AtomicLong droppedPackets = new AtomicLong();
    final AtomicLong blockedPackets = new AtomicLong();
    final AtomicLong delayedPackets = new AtomicLong();
    volatile String lastError = "";

    String toJson() {
      return "{"
        + "\"tcpAccepted\":" + tcpAccepted.get() + ","
        + "\"tcpActive\":" + tcpActive.get() + ","
        + "\"tcpConnectFailed\":" + tcpConnectFailed.get() + ","
        + "\"udpUploadPackets\":" + udpUploadPackets.get() + ","
        + "\"udpDownloadPackets\":" + udpDownloadPackets.get() + ","
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

  private final VpnService vpnService;
  private final Config config;
  private final Listener listener;
  private final Stats stats = new Stats();
  private final Set<Closeable> closeables = Collections.synchronizedSet(new HashSet<Closeable>());
  private final DirectionShaper uploadShaper;
  private final DirectionShaper downloadShaper;
  private volatile boolean running;
  private ServerSocket serverSocket;
  private Thread acceptThread;
  private long startedAt;
  private int port;

  LocalSocksProxy(VpnService vpnService, Config config, Listener listener) {
    this.vpnService = vpnService;
    this.config = config;
    this.listener = listener;
    this.uploadShaper = new DirectionShaper(config.uploadKbps);
    this.downloadShaper = new DirectionShaper(config.downloadKbps);
  }

  int start() throws IOException {
    serverSocket = new ServerSocket();
    serverSocket.setReuseAddress(true);
    serverSocket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0));
    port = serverSocket.getLocalPort();
    running = true;
    startedAt = System.currentTimeMillis();
    acceptThread = new Thread(new Runnable() {
      @Override
      public void run() {
        acceptLoop();
      }
    }, "weaknet-local-socks-accept");
    acceptThread.start();
    return port;
  }

  void stop() {
    running = false;
    closeQuietly(serverSocket);
    synchronized (closeables) {
      for (Closeable closeable : closeables) closeQuietly(closeable);
      closeables.clear();
    }
  }

  Stats getStats() {
    return stats;
  }

  private void acceptLoop() {
    while (running) {
      try {
        final Socket client = serverSocket.accept();
        addCloseable(client);
        Thread thread = new Thread(new Runnable() {
          @Override
          public void run() {
            handleClient(client);
          }
        }, "weaknet-local-socks-client");
        thread.start();
      } catch (SocketException error) {
        if (running) reportFatalError(error);
      } catch (IOException error) {
        reportFatalError(error);
      }
    }
  }

  private void handleClient(Socket client) {
    try {
      client.setTcpNoDelay(true);
      InputStream input = client.getInputStream();
      OutputStream output = client.getOutputStream();
      handleGreeting(input, output);
      SocksRequest request = readRequest(input);
      if (request.command == 1) {
        handleConnect(client, input, output, request);
        return;
      }
      if (request.command == 3) {
        handleUdpAssociate(client, input, output);
        return;
      }
      writeSocksReply(output, 0x07, InetAddress.getByName("0.0.0.0"), 0);
    } catch (IOException error) {
      if (running) reportConnectionError(error);
    } finally {
      removeCloseable(client);
      closeQuietly(client);
    }
  }

  private void handleGreeting(InputStream input, OutputStream output) throws IOException {
    int version = readByte(input);
    if (version != 5) throw new IOException("Unsupported SOCKS version: " + version);
    int methodCount = readByte(input);
    for (int index = 0; index < methodCount; index++) readByte(input);
    output.write(new byte[] { 0x05, 0x00 });
    output.flush();
  }

  private SocksRequest readRequest(InputStream input) throws IOException {
    int version = readByte(input);
    if (version != 5) throw new IOException("Unsupported SOCKS request version: " + version);
    SocksRequest request = new SocksRequest();
    request.command = readByte(input);
    readByte(input);
    request.atyp = readByte(input);
    request.host = readAddress(input, request.atyp);
    request.port = readPort(input);
    return request;
  }

  private void handleConnect(Socket client, InputStream clientInput, OutputStream clientOutput, SocksRequest request)
    throws IOException {
    Socket remote = new Socket();
    boolean active = false;
    addCloseable(remote);
    try {
      vpnService.protect(remote);
      remote.setTcpNoDelay(true);
      remote.connect(new InetSocketAddress(request.host, request.port), 12000);
      writeSocksReply(clientOutput, 0x00, InetAddress.getByName("0.0.0.0"), 0);
      stats.tcpAccepted.incrementAndGet();
      stats.tcpActive.incrementAndGet();
      active = true;

      Thread upload = pipe(clientInput, remote.getOutputStream(), true, client, remote);
      Thread download = pipe(remote.getInputStream(), clientOutput, false, remote, client);
      upload.start();
      download.start();
      joinQuietly(upload);
      closeQuietly(remote);
      closeQuietly(client);
      joinQuietly(download);
    } catch (IOException error) {
      stats.tcpConnectFailed.incrementAndGet();
      writeSocksReply(clientOutput, 0x05, InetAddress.getByName("0.0.0.0"), 0);
      throw error;
    } finally {
      if (active) stats.tcpActive.decrementAndGet();
      removeCloseable(remote);
      closeQuietly(remote);
    }
  }

  private Thread pipe(
    final InputStream input,
    final OutputStream output,
    final boolean upload,
    final Closeable source,
    final Closeable target
  ) {
    return new Thread(new Runnable() {
      @Override
      public void run() {
        byte[] buffer = new byte[8192];
        boolean latencyPending = true;
        try {
          while (running) {
            int read = input.read(buffer);
            if (read < 0) break;
            if (read == 0) continue;
            if (shape(upload, read, false, latencyPending)) {
              latencyPending = false;
              output.write(buffer, 0, read);
              output.flush();
              if (upload) stats.uploadBytes.addAndGet(read);
              else stats.downloadBytes.addAndGet(read);
            }
          }
        } catch (IOException error) {
          if (running) reportConnectionError(error);
        } finally {
          closeQuietly(source);
          closeQuietly(target);
        }
      }
    }, upload ? "weaknet-local-upload" : "weaknet-local-download");
  }

  private void handleUdpAssociate(Socket client, InputStream input, OutputStream output) throws IOException {
    UdpRelay relay = new UdpRelay();
    relay.start();
    try {
      writeSocksReply(output, 0x00, InetAddress.getByName("127.0.0.1"), relay.getPort());
      while (running && input.read() >= 0) {
        // The TCP control connection lifetime owns this UDP association.
      }
    } finally {
      relay.stop();
    }
  }

  private class UdpRelay {
    private DatagramSocket clientSocket;
    private DatagramSocket remoteSocket;
    private final Map<String, ClientTarget> targets = new ConcurrentHashMap<String, ClientTarget>();
    private Thread clientThread;
    private Thread remoteThread;

    void start() throws IOException {
      clientSocket = new DatagramSocket(null);
      clientSocket.setReuseAddress(true);
      clientSocket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0));
      remoteSocket = new DatagramSocket();
      vpnService.protect(remoteSocket);
      addCloseable(clientSocket);
      addCloseable(remoteSocket);
      clientThread = new Thread(new Runnable() {
        @Override
        public void run() {
          clientLoop();
        }
      }, "weaknet-local-udp-client");
      remoteThread = new Thread(new Runnable() {
        @Override
        public void run() {
          remoteLoop();
        }
      }, "weaknet-local-udp-remote");
      clientThread.start();
      remoteThread.start();
    }

    int getPort() {
      return clientSocket.getLocalPort();
    }

    void stop() {
      removeCloseable(clientSocket);
      removeCloseable(remoteSocket);
      closeQuietly(clientSocket);
      closeQuietly(remoteSocket);
    }

    private void clientLoop() {
      byte[] buffer = new byte[65535];
      while (running && clientSocket != null && !clientSocket.isClosed()) {
        DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
        try {
          clientSocket.receive(packet);
          UdpPayload payload = parseUdpPayload(packet);
          stats.udpUploadPackets.incrementAndGet();
          if (!shape(true, payload.payload.length, true)) continue;
          InetAddress targetAddress = InetAddress.getByName(payload.host);
          targets.put(targetKey(targetAddress, payload.port), new ClientTarget(payload.clientAddress, payload.clientPort));
          DatagramPacket outbound = new DatagramPacket(payload.payload, payload.payload.length, targetAddress, payload.port);
          remoteSocket.send(outbound);
          stats.uploadBytes.addAndGet(payload.payload.length);
        } catch (SocketException error) {
          if (running) reportConnectionError(error);
          return;
        } catch (IOException error) {
          if (running) reportConnectionError(error);
        }
      }
    }

    private void remoteLoop() {
      byte[] buffer = new byte[65535];
      while (running && remoteSocket != null && !remoteSocket.isClosed()) {
        DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
        try {
          remoteSocket.receive(packet);
          ClientTarget client = targets.get(targetKey(packet.getAddress(), packet.getPort()));
          if (client == null) continue;
          stats.udpDownloadPackets.incrementAndGet();
          if (!shape(false, packet.getLength(), true)) continue;
          byte[] wrapped = buildUdpResponse(packet.getAddress(), packet.getPort(), packet.getData(), packet.getOffset(), packet.getLength());
          DatagramPacket response = new DatagramPacket(wrapped, wrapped.length, client.clientAddress, client.clientPort);
          clientSocket.send(response);
          stats.downloadBytes.addAndGet(packet.getLength());
        } catch (SocketException error) {
          if (running) reportConnectionError(error);
          return;
        } catch (IOException error) {
          if (running) reportConnectionError(error);
        }
      }
    }
  }

  private UdpPayload parseUdpPayload(DatagramPacket packet) throws IOException {
    byte[] data = packet.getData();
    int index = packet.getOffset();
    int end = packet.getOffset() + packet.getLength();
    if (end - index < 4) throw new IOException("Invalid SOCKS UDP packet");
    index += 2;
    int frag = data[index++] & 0xff;
    if (frag != 0) throw new IOException("SOCKS UDP fragments are not supported");
    int atyp = data[index++] & 0xff;
    AddressParseResult address = readAddress(data, index, end, atyp);
    index = address.nextIndex;
    if (end - index < 2) throw new IOException("Invalid SOCKS UDP port");
    int port = ((data[index] & 0xff) << 8) | (data[index + 1] & 0xff);
    index += 2;
    byte[] payload = new byte[end - index];
    System.arraycopy(data, index, payload, 0, payload.length);

    UdpPayload result = new UdpPayload();
    result.atyp = atyp;
    result.host = address.host;
    result.port = port;
    result.payload = payload;
    result.clientAddress = packet.getAddress();
    result.clientPort = packet.getPort();
    return result;
  }

  private byte[] buildUdpResponse(InetAddress address, int port, byte[] payload, int offset, int length) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    output.write(0);
    output.write(0);
    output.write(0);
    byte[] addressBytes = address.getAddress();
    if (addressBytes.length == 4) output.write(1);
    else if (addressBytes.length == 16) output.write(4);
    else throw new IOException("Unsupported address length: " + addressBytes.length);
    output.write(addressBytes);
    output.write((port >> 8) & 0xff);
    output.write(port & 0xff);
    output.write(payload, offset, length);
    return output.toByteArray();
  }

  private boolean shape(boolean upload, int bytes, boolean packetBased) {
    return shape(upload, bytes, packetBased, true);
  }

  private boolean shape(boolean upload, int bytes, boolean packetBased, boolean applyLatency) {
    if (!running) return false;
    long periodicBlockRemainingMs = getPeriodicBlockRemainingMs();
    if (periodicBlockRemainingMs > 0) {
      stats.blockedPackets.incrementAndGet();
      if (packetBased) {
        stats.droppedPackets.incrementAndGet();
        return false;
      }
      sleepQuietly(periodicBlockRemainingMs);
      if (!running) return false;
    }
    if (packetBased && config.packetLossPercent > 0 && Math.random() * 100.0d < config.packetLossPercent) {
      stats.droppedPackets.incrementAndGet();
      return false;
    }
    long delayMs = applyLatency ? getDelayMs() : 0L;
    if (delayMs > 0) {
      stats.delayedPackets.incrementAndGet();
      sleepQuietly(delayMs);
    }
    if (upload) uploadShaper.throttle(bytes);
    else downloadShaper.throttle(bytes);
    return true;
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

  private String readAddress(InputStream input, int atyp) throws IOException {
    if (atyp == 1) {
      byte[] bytes = readFully(input, 4);
      return InetAddress.getByAddress(bytes).getHostAddress();
    }
    if (atyp == 3) {
      int length = readByte(input);
      return new String(readFully(input, length), "UTF-8");
    }
    if (atyp == 4) {
      byte[] bytes = readFully(input, 16);
      return InetAddress.getByAddress(bytes).getHostAddress();
    }
    throw new IOException("Unsupported address type: " + atyp);
  }

  private static class AddressParseResult {
    String host;
    int nextIndex;
  }

  private AddressParseResult readAddress(byte[] data, int index, int end, int atyp) throws IOException {
    AddressParseResult result = new AddressParseResult();
    if (atyp == 1) {
      if (end - index < 4) throw new IOException("Invalid IPv4 address");
      byte[] bytes = new byte[4];
      System.arraycopy(data, index, bytes, 0, 4);
      result.host = InetAddress.getByAddress(bytes).getHostAddress();
      result.nextIndex = index + 4;
      return result;
    }
    if (atyp == 3) {
      if (end - index < 1) throw new IOException("Invalid domain address");
      int length = data[index] & 0xff;
      index += 1;
      if (end - index < length) throw new IOException("Invalid domain length");
      result.host = new String(data, index, length, "UTF-8");
      result.nextIndex = index + length;
      return result;
    }
    if (atyp == 4) {
      if (end - index < 16) throw new IOException("Invalid IPv6 address");
      byte[] bytes = new byte[16];
      System.arraycopy(data, index, bytes, 0, 16);
      result.host = InetAddress.getByAddress(bytes).getHostAddress();
      result.nextIndex = index + 16;
      return result;
    }
    throw new IOException("Unsupported UDP address type: " + atyp);
  }

  private int readPort(InputStream input) throws IOException {
    return (readByte(input) << 8) | readByte(input);
  }

  private void writeSocksReply(OutputStream output, int reply, InetAddress address, int port) throws IOException {
    byte[] bytes = address.getAddress();
    output.write(0x05);
    output.write(reply);
    output.write(0x00);
    if (bytes.length == 4) output.write(0x01);
    else if (bytes.length == 16) output.write(0x04);
    else {
      output.write(0x01);
      bytes = new byte[] { 0, 0, 0, 0 };
    }
    output.write(bytes);
    output.write((port >> 8) & 0xff);
    output.write(port & 0xff);
    output.flush();
  }

  private int readByte(InputStream input) throws IOException {
    int value = input.read();
    if (value < 0) throw new EOFException();
    return value & 0xff;
  }

  private byte[] readFully(InputStream input, int length) throws IOException {
    byte[] bytes = new byte[length];
    int offset = 0;
    while (offset < length) {
      int read = input.read(bytes, offset, length - offset);
      if (read < 0) throw new EOFException();
      offset += read;
    }
    return bytes;
  }

  private String targetKey(InetAddress address, int port) {
    return address.getHostAddress() + ":" + port;
  }

  private void addCloseable(Closeable closeable) {
    if (closeable != null) closeables.add(closeable);
  }

  private void removeCloseable(Closeable closeable) {
    if (closeable != null) closeables.remove(closeable);
  }

  private void reportConnectionError(Throwable error) {
    stats.lastError = errorMessage(error);
  }

  private void reportFatalError(Throwable error) {
    String message = errorMessage(error);
    stats.lastError = message;
    if (listener != null) listener.onError(message);
  }

  private String errorMessage(Throwable error) {
    String message = error == null || error.getMessage() == null ? "local proxy error" : error.getMessage();
    return message;
  }

  private static void closeQuietly(Closeable closeable) {
    if (closeable == null) return;
    try {
      closeable.close();
    } catch (IOException ignored) {
    }
  }

  private static void closeQuietly(ServerSocket socket) {
    if (socket == null) return;
    try {
      socket.close();
    } catch (IOException ignored) {
    }
  }

  private static void sleepQuietly(long millis) {
    if (millis <= 0) return;
    try {
      Thread.sleep(millis);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    }
  }

  private static void joinQuietly(Thread thread) {
    if (thread == null) return;
    try {
      thread.join(400);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
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
