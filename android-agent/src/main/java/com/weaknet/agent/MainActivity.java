package com.weaknet.agent;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
  private static final int VPN_PERMISSION_REQUEST = 1001;

  private static final int BG = Color.rgb(245, 247, 248);
  private static final int SURFACE = Color.WHITE;
  private static final int TEXT = Color.rgb(23, 32, 29);
  private static final int MUTED = Color.rgb(100, 113, 109);
  private static final int LINE = Color.rgb(220, 229, 225);
  private static final int GREEN = Color.rgb(15, 123, 85);
  private static final int GREEN_DARK = Color.rgb(9, 95, 65);
  private static final int GREEN_SOFT = Color.rgb(232, 246, 240);
  private static final int AMBER = Color.rgb(154, 100, 0);
  private static final int AMBER_BG = Color.rgb(255, 244, 215);
  private static final int AMBER_LINE = Color.rgb(240, 213, 138);
  private static final int BLUE = Color.rgb(32, 95, 168);
  private static final int BLUE_BG = Color.rgb(232, 241, 251);
  private static final int BLUE_LINE = Color.rgb(198, 216, 237);
  private static final int RED = Color.rgb(179, 38, 30);
  private static final int RED_BG = Color.rgb(255, 235, 232);
  private static final int RED_LINE = Color.rgb(244, 187, 181);

  private TextView vpnPill;
  private TextView stateLabel;
  private TextView stateTitle;
  private TextView stateDescription;
  private TextView stateBadge;
  private TextView targetValue;
  private TextView linkValue;
  private TextView updatedValue;
  private TextView noticeTitle;
  private TextView noticeBody;
  private TextView diagnosticsToggle;
  private LinearLayout diagnosticsBody;
  private TextView nextStepView;
  private Button primaryButton;
  private Button secondaryButton;
  private boolean diagnosticsExpanded;
  private StatusSnapshot currentSnapshot;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(buildContentView());
    refreshStatus();
  }

  @Override
  protected void onResume() {
    super.onResume();
    refreshStatus();
  }

  private View buildContentView() {
    ScrollView scrollView = new ScrollView(this);
    scrollView.setFillViewport(true);
    scrollView.setBackgroundColor(BG);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(20), dp(22), dp(20), dp(28));
    scrollView.addView(root, new ScrollView.LayoutParams(
      ScrollView.LayoutParams.MATCH_PARENT,
      ScrollView.LayoutParams.WRAP_CONTENT
    ));

    root.addView(buildHeader(), blockParams(0, 0, 0, 18));
    root.addView(buildStatusCard(), blockParams(0, 0, 0, 14));
    root.addView(buildNoticeCard(), blockParams(0, 0, 0, 16));
    root.addView(buildActions(), blockParams(0, 0, 0, 14));
    root.addView(buildDiagnosticsCard(), blockParams(0, 0, 0, 14));
    nextStepView = text("", 13, TEXT, Typeface.NORMAL);
    nextStepView.setLineSpacing(0, 1.15f);
    nextStepView.setPadding(dp(14), dp(13), dp(14), dp(13));
    nextStepView.setBackground(rounded(BLUE_BG, BLUE_LINE, 8));
    root.addView(nextStepView, blockParams(0, 0, 0, 0));

    return scrollView;
  }

  private View buildHeader() {
    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.HORIZONTAL);
    header.setGravity(Gravity.CENTER_VERTICAL);

    LinearLayout titleColumn = new LinearLayout(this);
    titleColumn.setOrientation(LinearLayout.VERTICAL);
    LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);

    TextView title = text("弱网代理", 28, TEXT, Typeface.BOLD);
    title.setIncludeFontPadding(false);
    titleColumn.addView(title, blockParams(0, 0, 0, 7));

    TextView subtitle = text("由 Mac 控制台控制", 14, MUTED, Typeface.NORMAL);
    titleColumn.addView(subtitle);
    header.addView(titleColumn, titleParams);

    vpnPill = text("待授权", 12, GREEN_DARK, Typeface.NORMAL);
    vpnPill.setGravity(Gravity.CENTER);
    vpnPill.setPadding(dp(11), dp(7), dp(11), dp(7));
    vpnPill.setBackground(rounded(GREEN_SOFT, Color.rgb(183, 216, 201), 999));
    header.addView(vpnPill);
    return header;
  }

  private View buildStatusCard() {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(18), dp(18), dp(18), dp(18));
    card.setBackground(rounded(SURFACE, LINE, 8));

    LinearLayout stateRow = new LinearLayout(this);
    stateRow.setOrientation(LinearLayout.HORIZONTAL);
    stateRow.setGravity(Gravity.TOP);

    LinearLayout stateColumn = new LinearLayout(this);
    stateColumn.setOrientation(LinearLayout.VERTICAL);
    stateRow.addView(stateColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

    stateLabel = text("", 14, GREEN_DARK, Typeface.BOLD);
    stateColumn.addView(stateLabel, blockParams(0, 0, 0, 8));

    stateTitle = text("", 24, TEXT, Typeface.BOLD);
    stateTitle.setLineSpacing(0, 1.05f);
    stateColumn.addView(stateTitle, blockParams(0, 0, 0, 9));

    stateDescription = text("", 14, MUTED, Typeface.NORMAL);
    stateDescription.setLineSpacing(0, 1.25f);
    stateColumn.addView(stateDescription);

    stateBadge = text("", 13, GREEN_DARK, Typeface.BOLD);
    stateBadge.setGravity(Gravity.CENTER);
    stateBadge.setPadding(dp(10), dp(7), dp(10), dp(7));
    stateRow.addView(stateBadge);
    card.addView(stateRow);

    View divider = new View(this);
    divider.setBackgroundColor(LINE);
    card.addView(divider, blockParams(0, 16, 0, 15, LinearLayout.LayoutParams.MATCH_PARENT, 1));

    targetValue = addFactRow(card, "目标应用");
    linkValue = addFactRow(card, "链路");
    updatedValue = addFactRow(card, "更新时间");

    return card;
  }

  private View buildNoticeCard() {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(14), dp(13), dp(14), dp(13));
    card.setBackground(rounded(AMBER_BG, AMBER_LINE, 8));

    noticeTitle = text("不要开启系统“始终开启的 VPN”", 14, AMBER, Typeface.BOLD);
    card.addView(noticeTitle, blockParams(0, 0, 0, 6));

    noticeBody = text("否则 Mac 清除弱网后，手机可能自动拉起 VPN，导致状态和真实网络不一致。", 13, Color.rgb(77, 55, 8), Typeface.NORMAL);
    noticeBody.setLineSpacing(0, 1.15f);
    card.addView(noticeBody);
    return card;
  }

  private View buildActions() {
    LinearLayout actions = new LinearLayout(this);
    actions.setOrientation(LinearLayout.HORIZONTAL);
    actions.setGravity(Gravity.CENTER);

    primaryButton = new Button(this);
    styleButton(primaryButton, true, true);
    actions.addView(primaryButton, new LinearLayout.LayoutParams(0, dp(44), 1f));

    secondaryButton = new Button(this);
    styleButton(secondaryButton, false, true);
    LinearLayout.LayoutParams secondaryParams = new LinearLayout.LayoutParams(0, dp(44), 1f);
    secondaryParams.setMargins(dp(10), 0, 0, 0);
    actions.addView(secondaryButton, secondaryParams);

    return actions;
  }

  private View buildDiagnosticsCard() {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setBackground(rounded(SURFACE, LINE, 8));

    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.HORIZONTAL);
    header.setGravity(Gravity.CENTER_VERTICAL);
    header.setPadding(dp(16), dp(14), dp(16), dp(14));
    header.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        diagnosticsExpanded = !diagnosticsExpanded;
        renderDiagnostics(currentSnapshot);
      }
    });

    TextView title = text("诊断详情", 15, TEXT, Typeface.BOLD);
    header.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

    diagnosticsToggle = text("展开", 13, BLUE, Typeface.BOLD);
    header.addView(diagnosticsToggle);
    card.addView(header);

    diagnosticsBody = new LinearLayout(this);
    diagnosticsBody.setOrientation(LinearLayout.VERTICAL);
    diagnosticsBody.setPadding(dp(16), dp(12), dp(16), dp(15));
    diagnosticsBody.setBackgroundColor(Color.rgb(251, 252, 252));
    card.addView(diagnosticsBody);
    return card;
  }

  private TextView addFactRow(LinearLayout parent, String label) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.TOP);

    TextView labelView = text(label, 13, MUTED, Typeface.NORMAL);
    row.addView(labelView, new LinearLayout.LayoutParams(dp(74), LinearLayout.LayoutParams.WRAP_CONTENT));

    TextView valueView = text("", 15, TEXT, Typeface.BOLD);
    valueView.setLineSpacing(0, 1.2f);
    row.addView(valueView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
    parent.addView(row, blockParams(0, 0, 0, 12));
    return valueView;
  }

  private void requestVpnPermission() {
    Intent prepareIntent = VpnService.prepare(this);
    if (prepareIntent != null) {
      startActivityForResult(prepareIntent, VPN_PERMISSION_REQUEST);
      return;
    }
    refreshStatus();
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == VPN_PERMISSION_REQUEST) refreshStatus();
  }

  private void startServiceCompat(Intent intent) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(intent);
    } else {
      startService(intent);
    }
  }

  private void stopWeaknet() {
    Intent intent = new Intent(MainActivity.this, WeaknetVpnService.class);
    intent.setAction(WeaknetVpnService.ACTION_STOP);
    startServiceCompat(intent);
    renderStatus(StatusSnapshot.local("normal", "已发送停止手机端弱网命令。", isVpnPermissionGranted()));
    primaryButton.postDelayed(new Runnable() {
      @Override
      public void run() {
        refreshStatus();
      }
    }, 700);
  }

  private void refreshStatus() {
    renderStatus(readStatusSnapshot());
  }

  private StatusSnapshot readStatusSnapshot() {
    boolean permissionGranted = isVpnPermissionGranted();
    File file = new File(getFilesDir(), WeaknetVpnService.STATUS_FILE_NAME);
    if (!file.exists()) {
      if (permissionGranted) {
        return StatusSnapshot.local("idle", "VPN 权限已授权，但 VPN 还没有启动。", true);
      }
      return StatusSnapshot.local("needs_permission", "暂无状态。请先授权 VPN，然后在 Mac 控制台下发一个弱网预设。", false);
    }
    try (FileInputStream input = new FileInputStream(file)) {
      byte[] bytes = new byte[(int) file.length()];
      int read = input.read(bytes);
      if (read <= 0) return StatusSnapshot.local("error", "状态文件为空。", permissionGranted);
      StatusSnapshot snapshot = StatusSnapshot.fromJson(new String(bytes, 0, read, "UTF-8"), permissionGranted);
      if ("needs_permission".equals(snapshot.mode) && permissionGranted) {
        snapshot.mode = "idle";
        snapshot.running = false;
        snapshot.message = "上一次下发停在未授权状态；现在请回到 Mac 控制台再次点击“应用预设”。";
      }
      return snapshot;
    } catch (IOException error) {
      return StatusSnapshot.local("error", "无法读取状态：" + error.getMessage(), permissionGranted);
    }
  }

  private void renderStatus(StatusSnapshot snapshot) {
    currentSnapshot = snapshot;
    if (snapshot == null) snapshot = StatusSnapshot.local("error", "状态未知。", isVpnPermissionGranted());

    int accent = getAccent(snapshot);
    vpnPill.setText(getVpnPillText(snapshot));
    vpnPill.setTextColor(accent);
    vpnPill.setBackground(rounded(getAccentSoft(snapshot), getAccentLine(snapshot), 999));

    stateLabel.setText(getStateLabel(snapshot));
    stateLabel.setTextColor(accent);
    stateTitle.setText(getStateTitle(snapshot));
    stateDescription.setText(getStateDescription(snapshot));

    stateBadge.setText(getStateBadge(snapshot));
    stateBadge.setTextColor(accent);
    stateBadge.setBackground(rounded(getAccentSoft(snapshot), getAccentLine(snapshot), 999));

    targetValue.setText(firstNonEmpty(snapshot.targetPackage, "未指定"));
    linkValue.setText(getLinkText(snapshot));
    updatedValue.setText(formatUpdatedAt(snapshot.updatedAt));

    configureNotice(snapshot);
    configureActions(snapshot);
    renderDiagnostics(snapshot);
    nextStepView.setText(getNextStep(snapshot));
  }

  private void configureNotice(StatusSnapshot snapshot) {
    if ("needs_permission".equals(snapshot.mode)) {
      noticeTitle.setText("先完成一次 VPN 授权");
      noticeBody.setText("授权后回到 Mac 控制台再次点击“应用预设”。不要在系统 VPN 设置中开启“始终开启的 VPN”。");
      return;
    }
    noticeTitle.setText("不要开启系统“始终开启的 VPN”");
    noticeBody.setText("否则 Mac 清除弱网后，手机可能自动拉起 VPN，导致状态和真实网络不一致。");
  }

  private void configureActions(final StatusSnapshot snapshot) {
    if (!snapshot.permissionGranted || "needs_permission".equals(snapshot.mode)) {
      primaryButton.setText("授权 VPN");
      primaryButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          requestVpnPermission();
        }
      });
      secondaryButton.setText("刷新状态");
      secondaryButton.setEnabled(true);
      styleButton(secondaryButton, false, true);
      secondaryButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          refreshStatus();
        }
      });
      return;
    }

    primaryButton.setText("刷新状态");
    primaryButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        refreshStatus();
      }
    });

    if (snapshot.running || "error".equals(snapshot.mode)) {
      secondaryButton.setText("停止手机端弱网");
      secondaryButton.setEnabled(true);
      styleButton(secondaryButton, false, true);
      secondaryButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          stopWeaknet();
        }
      });
    } else {
      secondaryButton.setText("VPN 已授权");
      secondaryButton.setEnabled(false);
      styleButton(secondaryButton, false, false);
      secondaryButton.setOnClickListener(null);
    }
  }

  private void renderDiagnostics(StatusSnapshot snapshot) {
    diagnosticsToggle.setText(diagnosticsExpanded ? "收起" : "展开");
    diagnosticsBody.setVisibility(diagnosticsExpanded ? View.VISIBLE : View.GONE);
    diagnosticsBody.removeAllViews();
    if (!diagnosticsExpanded || snapshot == null) return;

    addDiagnosticRow("mode", firstNonEmpty(snapshot.mode, "unknown"));
    addDiagnosticRow("presetKey", firstNonEmpty(snapshot.presetKey, "none"));
    addDiagnosticRow("targetPackage", firstNonEmpty(snapshot.targetPackage, "none"));
    if (!isEmpty(snapshot.socksHost) || snapshot.socksPort > 0) {
      addDiagnosticRow("Mac SOCKS", firstNonEmpty(snapshot.socksHost, "unknown") + ":" + snapshot.socksPort);
    }
    if (!isEmpty(snapshot.tproxyStats)) addDiagnosticRow("tproxyStats", snapshot.tproxyStats);
    if (!isEmpty(snapshot.error)) addDiagnosticRow("error", snapshot.error);
    if (!isEmpty(snapshot.tproxyLogTail)) addDiagnosticRow("最近日志", lastLine(snapshot.tproxyLogTail));
  }

  private void addDiagnosticRow(String label, String value) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.TOP);

    TextView labelView = text(label, 13, MUTED, Typeface.NORMAL);
    row.addView(labelView, new LinearLayout.LayoutParams(dp(98), LinearLayout.LayoutParams.WRAP_CONTENT));

    TextView valueView = text(value, 13, TEXT, Typeface.BOLD);
    valueView.setGravity(Gravity.RIGHT);
    valueView.setLineSpacing(0, 1.15f);
    row.addView(valueView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
    diagnosticsBody.addView(row, blockParams(0, 0, 0, 9));
  }

  private String getVpnPillText(StatusSnapshot snapshot) {
    if (snapshot.running) return "VPN 已接管";
    if (snapshot.permissionGranted) return "VPN 已授权";
    return "待授权";
  }

  private String getStateLabel(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return "异常";
    if ("needs_permission".equals(snapshot.mode)) return "待授权";
    if (snapshot.running) return "生效中";
    if ("normal".equals(snapshot.mode)) return "未开启";
    return "待命";
  }

  private String getStateTitle(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return "启动失败";
    if ("needs_permission".equals(snapshot.mode)) return "需要 VPN 授权";
    if ("unsupported".equals(snapshot.mode)) return "预设暂不支持";
    if ("idle".equals(snapshot.mode)) return "等待 Mac 控制台";
    if ("normal".equals(snapshot.mode)) return "正常网络";
    if (snapshot.running) return formatPreset(snapshot);
    return "未开启弱网";
  }

  private String getStateDescription(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, snapshot.error, "弱网代理启动失败。");
    if ("needs_permission".equals(snapshot.mode)) return "请先完成一次系统 VPN 授权。";
    if ("unsupported".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "当前预设暂不支持 Android VPN Agent。");
    if ("socks".equals(snapshot.mode) && snapshot.running) return "通过 Mac SOCKS 出口接管目标应用流量。";
    if ("blackhole".equals(snapshot.mode) && snapshot.running) return "目标应用流量已被直接丢弃。";
    if ("normal".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "手机端弱网已停止，目标应用恢复正常网络。");
    if ("idle".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "请在 Mac 控制台选择目标包名和弱网预设。");
    return firstNonEmpty(snapshot.message, snapshot.running ? "弱网代理正在运行。" : "弱网代理未运行。");
  }

  private String getStateBadge(StatusSnapshot snapshot) {
    if ("socks".equals(snapshot.mode)) return "SOCKS";
    if ("blackhole".equals(snapshot.mode)) return "断网";
    if ("needs_permission".equals(snapshot.mode)) return "授权";
    if ("error".equals(snapshot.mode)) return "错误";
    if ("normal".equals(snapshot.mode)) return "正常";
    if ("idle".equals(snapshot.mode)) return "待命";
    return firstNonEmpty(snapshot.mode, "未知");
  }

  private String getLinkText(StatusSnapshot snapshot) {
    if ("socks".equals(snapshot.mode)) return "Android VPN > Mac SOCKS > 弱网规则";
    if ("blackhole".equals(snapshot.mode)) return "Android VPN > 直接丢包";
    if ("needs_permission".equals(snapshot.mode)) return "系统授权 > Mac 控制台";
    if ("error".equals(snapshot.mode)) return "Android Agent > 错误";
    return "Mac 控制台 > Android Agent";
  }

  private String getNextStep(StatusSnapshot snapshot) {
    if ("needs_permission".equals(snapshot.mode)) return "下一步：点击“授权 VPN”，同意系统弹窗后回到 Mac 控制台重新应用预设。";
    if ("idle".equals(snapshot.mode)) return "下一步：回到 Mac 控制台选择目标包名和弱网预设，然后点击“应用预设”。";
    if ("socks".equals(snapshot.mode) && snapshot.running) return "当前弱网已生效。若游戏无网络，请回到 Mac 控制台重新应用预设，并检查 SOCKS 计数与 tun0 流量。";
    if ("blackhole".equals(snapshot.mode) && snapshot.running) return "当前为 100% 丢包，只会影响目标应用。结束测试后建议回到 Mac 控制台清除弱网。";
    if ("error".equals(snapshot.mode)) return "下一步：先刷新状态；若仍失败，请展开诊断详情查看错误和最近日志。";
    if ("normal".equals(snapshot.mode)) return "当前手机端弱网已停止。需要继续测试时，请回到 Mac 控制台重新下发预设。";
    return "请以 Mac 控制台为准下发或清除弱网。";
  }

  private int getAccent(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER;
    if (snapshot.running) return GREEN_DARK;
    return BLUE;
  }

  private int getAccentSoft(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED_BG;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER_BG;
    if (snapshot.running) return GREEN_SOFT;
    return BLUE_BG;
  }

  private int getAccentLine(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED_LINE;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER_LINE;
    if (snapshot.running) return Color.rgb(183, 216, 201);
    return BLUE_LINE;
  }

  private String formatPreset(StatusSnapshot snapshot) {
    if (!isEmpty(snapshot.displayName)) return snapshot.displayName;
    String presetKey = snapshot.presetKey;
    if ("normal".equals(presetKey)) return "正常网络";
    if ("wifi".equals(presetKey)) return "Wi-Fi 网络";
    if ("lte_4g".equals(presetKey)) return "4G/LTE 网络";
    if ("three_g".equals(presetKey)) return "3G 网络";
    if ("dsl".equals(presetKey)) return "DSL 宽带";
    if ("edge".equals(presetKey)) return "EDGE 网络";
    if ("high_latency".equals(presetKey)) return "高延迟网络";
    if ("high_loss".equals(presetKey)) return "高丢包网络";
    if ("intermittent".equals(presetKey)) return "断续网络";
    if ("loss_100".equals(presetKey) || "disconnect".equals(presetKey)) return "断网/100% 丢包";
    if ("custom".equals(presetKey)) return "自定义弱网";
    return firstNonEmpty(presetKey, "弱网预设");
  }

  private String formatUpdatedAt(long updatedAt) {
    if (updatedAt <= 0) return "暂无";
    return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.CHINA).format(new Date(updatedAt));
  }

  private TextView text(String value, int sp, int color, int style) {
    TextView view = new TextView(this);
    view.setText(value);
    view.setTextSize(sp);
    view.setTextColor(color);
    view.setTypeface(Typeface.DEFAULT, style);
    return view;
  }

  private void styleButton(Button button, boolean primary, boolean enabled) {
    button.setAllCaps(false);
    button.setTextSize(15);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setMinHeight(0);
    button.setMinimumHeight(0);
    button.setPadding(dp(8), 0, dp(8), 0);
    button.setEnabled(enabled);
    button.setTextColor(buttonTextColors(primary));
    button.setBackground(buttonBackground(primary));
    installButtonPressMotion(button, enabled);
  }

  private ColorStateList buttonTextColors(boolean primary) {
    int disabled = primary ? Color.rgb(237, 244, 241) : MUTED;
    int pressed = primary ? Color.WHITE : GREEN_DARK;
    int normal = primary ? Color.WHITE : TEXT;
    return new ColorStateList(
      new int[][] {
        new int[] { -android.R.attr.state_enabled },
        new int[] { android.R.attr.state_pressed },
        new int[] {}
      },
      new int[] { disabled, pressed, normal }
    );
  }

  private Drawable buttonBackground(boolean primary) {
    StateListDrawable states = new StateListDrawable();
    states.addState(
      new int[] { -android.R.attr.state_enabled },
      buttonShape(
        primary ? Color.rgb(157, 174, 168) : Color.rgb(246, 248, 247),
        primary ? Color.rgb(157, 174, 168) : LINE
      )
    );
    states.addState(
      new int[] { android.R.attr.state_pressed },
      buttonShape(
        primary ? GREEN_DARK : Color.rgb(237, 245, 241),
        primary ? GREEN_DARK : Color.rgb(142, 188, 168)
      )
    );
    states.addState(
      new int[] {},
      buttonShape(
        primary ? GREEN : SURFACE,
        primary ? GREEN : Color.rgb(203, 216, 211)
      )
    );

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      int ripple = primary ? Color.argb(64, 255, 255, 255) : Color.argb(32, 15, 123, 85);
      return new RippleDrawable(ColorStateList.valueOf(ripple), states, null);
    }
    return states;
  }

  private GradientDrawable buttonShape(int fill, int stroke) {
    return rounded(fill, stroke, 8);
  }

  private void installButtonPressMotion(final Button button, boolean enabled) {
    button.setTranslationY(0f);
    if (!enabled) {
      button.setOnTouchListener(null);
      return;
    }
    button.setOnTouchListener(new View.OnTouchListener() {
      @Override
      public boolean onTouch(View view, MotionEvent event) {
        if (!view.isEnabled()) return false;
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
          view.animate().cancel();
          view.setTranslationY(dp(2));
        } else if (
          event.getAction() == MotionEvent.ACTION_UP ||
          event.getAction() == MotionEvent.ACTION_CANCEL ||
          event.getAction() == MotionEvent.ACTION_OUTSIDE
        ) {
          view.animate().translationY(0f).setDuration(90).start();
        }
        return false;
      }
    });
  }

  private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setColor(fill);
    drawable.setCornerRadius(dp(radiusDp));
    drawable.setStroke(dp(1), stroke);
    return drawable;
  }

  private LinearLayout.LayoutParams blockParams(int left, int top, int right, int bottom) {
    return blockParams(left, top, right, bottom, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
  }

  private LinearLayout.LayoutParams blockParams(int left, int top, int right, int bottom, int width, int height) {
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width, height);
    params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
    return params;
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private boolean isVpnPermissionGranted() {
    return VpnService.prepare(this) == null;
  }

  private static boolean isEmpty(String value) {
    return value == null || value.length() == 0;
  }

  private static String firstNonEmpty(String... values) {
    if (values == null) return "";
    for (String value : values) {
      if (!isEmpty(value)) return value;
    }
    return "";
  }

  private static String lastLine(String value) {
    if (isEmpty(value)) return "";
    String normalized = value.replace("\r", "\n").trim();
    int index = normalized.lastIndexOf('\n');
    String line = index >= 0 ? normalized.substring(index + 1) : normalized;
    return line.length() > 120 ? line.substring(0, 117) + "..." : line;
  }

  private static String optString(JSONObject json, String key) {
    String value = json.optString(key, "");
    return "null".equals(value) ? "" : value;
  }

  private static class StatusSnapshot {
    boolean permissionGranted;
    boolean running;
    String mode = "";
    String presetKey = "";
    String displayName = "";
    String targetPackage = "";
    String message = "";
    String error = "";
    String socksHost = "";
    int socksPort;
    String tproxyStats = "";
    String tproxyLogTail = "";
    long updatedAt;

    static StatusSnapshot local(String mode, String message, boolean permissionGranted) {
      StatusSnapshot snapshot = new StatusSnapshot();
      snapshot.permissionGranted = permissionGranted;
      snapshot.running = false;
      snapshot.mode = mode;
      snapshot.message = message;
      snapshot.updatedAt = System.currentTimeMillis();
      return snapshot;
    }

    static StatusSnapshot fromJson(String raw, boolean permissionGranted) {
      StatusSnapshot snapshot = new StatusSnapshot();
      snapshot.permissionGranted = permissionGranted;
      try {
        JSONObject status = new JSONObject(raw);
        snapshot.running = status.optBoolean("running", false);
        snapshot.mode = optString(status, "mode");
        snapshot.presetKey = optString(status, "presetKey");
        snapshot.displayName = firstNonEmpty(optString(status, "displayName"), optString(status, "displayNameZh"));
        snapshot.targetPackage = optString(status, "targetPackage");
        snapshot.message = optString(status, "message");
        snapshot.error = optString(status, "error");
        snapshot.socksHost = optString(status, "socksHost");
        snapshot.socksPort = status.optInt("socksPort", 0);
        Object stats = status.opt("tproxyStats");
        snapshot.tproxyStats = stats == null ? "" : String.valueOf(stats);
        snapshot.tproxyLogTail = optString(status, "tproxyLogTail");
        snapshot.updatedAt = status.optLong("updatedAt", 0L);
      } catch (Exception error) {
        snapshot.mode = "error";
        snapshot.message = "状态内容无法解析。";
        snapshot.error = error.getMessage();
        snapshot.updatedAt = System.currentTimeMillis();
      }
      return snapshot;
    }
  }
}
