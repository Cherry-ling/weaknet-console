package com.weaknet.agent;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Intent;
import android.content.pm.PackageManager;
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
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
  private static final int VPN_PERMISSION_REQUEST = 1001;
  private static final int STATUS_REFRESH_MS = 500;
  private static final String PREFS_NAME = "weaknet_agent";
  private static final String PREF_TARGET_PACKAGE = "target_package";
  private static final String PREF_TARGET_SCOPE = "target_scope";
  private static final String PREF_LEGACY_TARGET_PACKAGES = "target_packages";
  private static final String PREF_CONTROL_COLLAPSED = "control_collapsed";
  private static final String PREF_THEME = "theme";
  private static final String PREF_VIEW_MODE = "view_mode";
  private static final String SCOPE_SINGLE = "single";
  private static final String SCOPE_GLOBAL = "global";
  private static final String VIEW_AUTO = "auto";
  private static final String VIEW_HOST = "host";
  private static final String VIEW_LOCAL = "local";
  private static final String DATAPLANE_HOST_SOCKS = "host-socks";
  private static final String DATAPLANE_ANDROID_LOCAL = "android-local";
  private static final String THEME_TERMINAL_AURORA = "terminal-aurora";
  private static final String THEME_CYBER = "cyber";
  private static final String THEME_CLASSIC = "classic";
  private static final Pattern PACKAGE_PATTERN = Pattern.compile("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+");

  private static int BG = Color.rgb(245, 247, 248);
  private static int SURFACE = Color.WHITE;
  private static int SURFACE_MUTED = Color.rgb(251, 252, 252);
  private static int TEXT = Color.rgb(23, 32, 29);
  private static int MUTED = Color.rgb(100, 113, 109);
  private static int LINE = Color.rgb(220, 229, 225);
  private static int GREEN = Color.rgb(15, 123, 85);
  private static int GREEN_DARK = Color.rgb(9, 95, 65);
  private static int GREEN_SOFT = Color.rgb(232, 246, 240);
  private static int AMBER = Color.rgb(154, 100, 0);
  private static int AMBER_BG = Color.rgb(255, 244, 215);
  private static int AMBER_LINE = Color.rgb(240, 213, 138);
  private static int BLUE = Color.rgb(32, 95, 168);
  private static int BLUE_BG = Color.rgb(232, 241, 251);
  private static int BLUE_LINE = Color.rgb(198, 216, 237);
  private static int RED = Color.rgb(179, 38, 30);
  private static int RED_BG = Color.rgb(255, 235, 232);
  private static int RED_LINE = Color.rgb(244, 187, 181);
  private static int PRIMARY_TEXT = Color.WHITE;
  private static int PRIMARY_PRESSED = Color.rgb(9, 95, 65);
  private static int PAGE_TOP = Color.rgb(243, 246, 248);
  private static int PAGE_MID = Color.rgb(232, 246, 248);
  private static int PAGE_BOTTOM = Color.rgb(248, 242, 232);
  private static int GLASS_TOP = Color.WHITE;
  private static int GLASS_BOTTOM = Color.rgb(247, 249, 251);
  private static int GLASS_MUTED_TOP = Color.WHITE;
  private static int GLASS_MUTED_BOTTOM = Color.rgb(240, 246, 248);
  private static int PRIMARY_TOP = Color.rgb(10, 144, 102);
  private static int PRIMARY_BOTTOM = Color.rgb(8, 116, 67);
  private static int PRIMARY_PRESSED_TOP = Color.rgb(9, 125, 84);
  private static int PRIMARY_PRESSED_BOTTOM = Color.rgb(6, 101, 59);

  private TextView vpnPill;
  private TextView headerSubtitle;
  private Button modeSwitchButton;
  private LinearLayout localControlCard;
  private TextView controlTitle;
  private TextView hostControlInfo;
  private TextView stateLabel;
  private TextView stateTitle;
  private TextView stateDescription;
  private TextView stateBadge;
  private TextView stateLiveView;
  private LinearLayout statusHeader;
  private TextView targetValue;
  private TextView linkValue;
  private TextView updatedValue;
  private TextView statsTcpValue;
  private TextView statsTrafficValue;
  private TextView statsDropValue;
  private TextView noticeTitle;
  private TextView noticeBody;
  private TextView diagnosticsToggle;
  private LinearLayout diagnosticsBody;
  private TextView nextStepView;
  private EditText targetPackageInput;
  private TextView selectedPresetLabel;
  private TextView confirmedPackageView;
  private TextView scopeHintView;
  private Button controlCollapseButton;
  private Button scopeSingleButton;
  private Button scopeGlobalButton;
  private Button selectPackageButton;
  private Button confirmTargetButton;
  private LinearLayout controlDetailsContainer;
  private LinearLayout targetModuleContainer;
  private LinearLayout packageListContainer;
  private TextView presetLabel;
  private LinearLayout presetList;
  private Button[] presetButtons;
  private Button primaryButton;
  private Button secondaryButton;
  private boolean diagnosticsExpanded;
  private boolean controlCollapsed;
  private boolean pendingApplyAfterPermission;
  private boolean targetTextChangeInternal;
  private int selectedPresetIndex = 2;
  private String confirmedTargetPackage = "";
  private String targetScope = SCOPE_SINGLE;
  private String currentThemeKey = THEME_TERMINAL_AURORA;
  private String viewModeOverride = VIEW_AUTO;
  private String lastActualViewKey = "";
  private StatusSnapshot currentSnapshot;
  private final Handler refreshHandler = new Handler(Looper.getMainLooper());
  private final Runnable refreshRunnable = new Runnable() {
    @Override
    public void run() {
      refreshStatus();
      refreshHandler.postDelayed(this, STATUS_REFRESH_MS);
    }
  };

  private static final Preset[] LOCAL_PRESETS = new Preset[] {
    new Preset("normal", "正常网络", "停止弱网", 40, 10, 0, null, null, "none", 0, 0),
    new Preset("wifi", "Wi-Fi", "稳定无线", 40, 10, 0, 50000d, 20000d, "none", 0, 0),
    new Preset("lte_4g", "4G/LTE", "移动网络", 80, 20, 0.1, 20000d, 5000d, "none", 0, 0),
    new Preset("three_g", "3G", "较慢移动", 180, 60, 0.5, 1500d, 750d, "none", 0, 0),
    new Preset("edge", "EDGE", "极慢移动", 400, 120, 2, 240d, 120d, "none", 0, 0),
    new Preset("dsl", "DSL 宽带", "低速家宽", 120, 30, 0.2, 2000d, 256d, "none", 0, 0),
    new Preset("high_latency", "高延迟", "RTT 800ms", 800, 200, 1, 5000d, 1000d, "none", 0, 0),
    new Preset("high_loss", "高丢包", "丢包 10%", 200, 80, 10, 3000d, 800d, "none", 0, 0),
    new Preset("intermittent", "断续", "30s/5s", 300, 100, 5, 1000d, 300d, "periodic", 5, 30),
    new Preset("network_wave", "网络波动", "地铁/电梯随机波动", 100, 0, 2, 500d, 200d, "none", 0, 0, true),
    new Preset("loss_100", "100% 丢包", "完全断网", null, null, 100, 0d, 0d, "always", 0, 0),
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    clearLegacyMultiPackagePrefs();
    currentThemeKey = loadThemeKey();
    viewModeOverride = loadViewModeOverride();
    applyThemePalette(currentThemeKey);
    setContentView(buildContentView());
    refreshStatus();
  }

  @Override
  protected void onResume() {
    super.onResume();
    refreshStatus();
    startAutoRefresh();
  }

  @Override
  protected void onPause() {
    stopAutoRefresh();
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    stopAutoRefresh();
    super.onDestroy();
  }

  private void startAutoRefresh() {
    refreshHandler.removeCallbacks(refreshRunnable);
    refreshHandler.postDelayed(refreshRunnable, STATUS_REFRESH_MS);
  }

  private void stopAutoRefresh() {
    refreshHandler.removeCallbacks(refreshRunnable);
  }

  private View buildContentView() {
    ScrollView scrollView = new ScrollView(this);
    scrollView.setFillViewport(true);
    scrollView.setBackground(pageBackground());

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(20), dp(22), dp(20), dp(28));
    scrollView.addView(root, new ScrollView.LayoutParams(
      ScrollView.LayoutParams.MATCH_PARENT,
      ScrollView.LayoutParams.WRAP_CONTENT
    ));

    root.addView(buildHeader(), blockParams(0, 0, 0, 18));
    root.addView(buildLocalControlCard(), blockParams(0, 0, 0, 14));
    root.addView(buildStatusCard(), blockParams(0, 0, 0, 14));
    root.addView(buildNoticeCard(), blockParams(0, 0, 0, 16));
    root.addView(buildDiagnosticsCard(), blockParams(0, 0, 0, 14));
    nextStepView = text("", 13, TEXT, Typeface.NORMAL);
    nextStepView.setLineSpacing(0, 1.15f);
    nextStepView.setPadding(dp(14), dp(13), dp(14), dp(13));
    nextStepView.setBackground(glassTintBackground(BLUE_BG, BLUE_LINE, 8));
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

    headerSubtitle = text("手机本地独立运行", 14, MUTED, Typeface.NORMAL);
    titleColumn.addView(headerSubtitle);
    header.addView(titleColumn, titleParams);

    modeSwitchButton = new Button(this);
    modeSwitchButton.setAllCaps(false);
    modeSwitchButton.setTextSize(12);
    modeSwitchButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    modeSwitchButton.setMinHeight(0);
    modeSwitchButton.setMinimumHeight(0);
    modeSwitchButton.setPadding(dp(9), 0, dp(9), 0);
    modeSwitchButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        toggleViewMode();
      }
    });
    modeSwitchButton.setOnLongClickListener(new View.OnLongClickListener() {
      @Override
      public boolean onLongClick(View view) {
        viewModeOverride = VIEW_AUTO;
        saveViewModeOverride(viewModeOverride);
        renderStatus(currentSnapshot == null ? readStatusSnapshot() : currentSnapshot);
        return true;
      }
    });
    LinearLayout.LayoutParams switchParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
    switchParams.setMargins(0, 0, dp(8), 0);
    header.addView(modeSwitchButton, switchParams);

    vpnPill = text("待授权", 12, GREEN_DARK, Typeface.NORMAL);
    vpnPill.setGravity(Gravity.CENTER);
    vpnPill.setPadding(dp(11), dp(7), dp(11), dp(7));
    vpnPill.setBackground(glassTintBackground(GREEN_SOFT, GREEN, 999));
    header.addView(vpnPill);
    return header;
  }

  private View buildLocalControlCard() {
    LinearLayout card = new LinearLayout(this);
    localControlCard = card;
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(18), dp(18), dp(18), dp(18));
    card.setBackground(glassControlCardBackground());

    LinearLayout titleRow = new LinearLayout(this);
    titleRow.setOrientation(LinearLayout.HORIZONTAL);
    titleRow.setGravity(Gravity.CENTER_VERTICAL);
    controlTitle = text("本地控制", 18, TEXT, Typeface.BOLD);
    titleRow.addView(controlTitle, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

    LinearLayout titleActions = new LinearLayout(this);
    titleActions.setOrientation(LinearLayout.HORIZONTAL);
    titleActions.setGravity(Gravity.CENTER_VERTICAL);
    selectedPresetLabel = text("", 13, BLUE, Typeface.BOLD);
    selectedPresetLabel.setGravity(Gravity.RIGHT);
    titleActions.addView(selectedPresetLabel);

    controlCollapsed = loadControlCollapsed();
    controlCollapseButton = buildControlCollapseButton();
    LinearLayout.LayoutParams collapseParams = new LinearLayout.LayoutParams(dp(36), dp(34));
    collapseParams.setMargins(dp(8), 0, 0, 0);
    titleActions.addView(controlCollapseButton, collapseParams);
    titleRow.addView(titleActions);
    card.addView(titleRow, blockParams(0, 0, 0, 12));

    hostControlInfo = text("", 13, TEXT, Typeface.NORMAL);
    hostControlInfo.setLineSpacing(0, 1.2f);
    hostControlInfo.setPadding(dp(12), dp(11), dp(12), dp(11));
    hostControlInfo.setBackground(glassTintBackground(BLUE_BG, BLUE_LINE, 8));
    hostControlInfo.setVisibility(View.GONE);
    card.addView(hostControlInfo, blockParams(0, 0, 0, 12));

    targetScope = loadTargetScope();
    confirmedTargetPackage = loadTargetPackage();

    controlDetailsContainer = new LinearLayout(this);
    controlDetailsContainer.setOrientation(LinearLayout.VERTICAL);

    TextView scopeLabel = text("控制范围", 13, MUTED, Typeface.NORMAL);
    controlDetailsContainer.addView(scopeLabel, blockParams(0, 0, 0, 7));
    controlDetailsContainer.addView(buildScopeControls(), blockParams(0, 0, 0, 8));
    scopeHintView = text("", 12, MUTED, Typeface.NORMAL);
    scopeHintView.setLineSpacing(0, 1.15f);
    controlDetailsContainer.addView(scopeHintView, blockParams(0, 0, 0, 12));

    targetModuleContainer = new LinearLayout(this);
    targetModuleContainer.setOrientation(LinearLayout.VERTICAL);

    TextView targetLabel = text("目标包名", 13, MUTED, Typeface.NORMAL);
    targetModuleContainer.addView(targetLabel, blockParams(0, 0, 0, 7));

    LinearLayout targetRow = new LinearLayout(this);
    targetRow.setOrientation(LinearLayout.HORIZONTAL);
    targetRow.setGravity(Gravity.CENTER_VERTICAL);

    targetPackageInput = new EditText(this);
    targetPackageInput.setSingleLine(true);
    targetPackageInput.setTextSize(15);
    targetPackageInput.setTextColor(TEXT);
    targetPackageInput.setHintTextColor(MUTED);
    targetPackageInput.setHint("例如 com.ffm.global");
    targetPackageInput.setText(getInputTextForScope());
    targetPackageInput.setPadding(dp(12), 0, dp(12), 0);
    targetPackageInput.setBackground(glassInputBackground());
    targetPackageInput.addTextChangedListener(new TextWatcher() {
      @Override
      public void beforeTextChanged(CharSequence value, int start, int count, int after) {
      }

      @Override
      public void onTextChanged(CharSequence value, int start, int before, int count) {
        if (!targetTextChangeInternal) updateTargetConfirmationView();
      }

      @Override
      public void afterTextChanged(Editable value) {
      }
    });
    targetRow.addView(targetPackageInput, new LinearLayout.LayoutParams(0, dp(46), 1f));

    confirmedPackageView = text("", 12, MUTED, Typeface.BOLD);
    confirmedPackageView.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams confirmedParams = new LinearLayout.LayoutParams(dp(58), dp(46));
    confirmedParams.setMargins(dp(8), 0, 0, 0);
    targetRow.addView(confirmedPackageView, confirmedParams);

    confirmTargetButton = new Button(this);
    confirmTargetButton.setText("✓");
    styleButton(confirmTargetButton, true, true);
    confirmTargetButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        confirmTargetPackage();
      }
    });
    LinearLayout.LayoutParams confirmParams = new LinearLayout.LayoutParams(dp(52), dp(46));
    confirmParams.setMargins(dp(8), 0, 0, 0);
    targetRow.addView(confirmTargetButton, confirmParams);
    targetModuleContainer.addView(targetRow, blockParams(0, 0, 0, 8));

    LinearLayout packageActionRow = new LinearLayout(this);
    packageActionRow.setOrientation(LinearLayout.HORIZONTAL);
    packageActionRow.setGravity(Gravity.CENTER_VERTICAL);

    selectPackageButton = new Button(this);
    selectPackageButton.setText("选择应用");
    styleButton(selectPackageButton, false, true);
    selectPackageButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        togglePackageList();
      }
    });
    packageActionRow.addView(selectPackageButton, new LinearLayout.LayoutParams(0, dp(40), 1f));
    targetModuleContainer.addView(packageActionRow, blockParams(0, 0, 0, 10));

    packageListContainer = new LinearLayout(this);
    packageListContainer.setOrientation(LinearLayout.VERTICAL);
    packageListContainer.setPadding(dp(10), dp(10), dp(10), dp(6));
    packageListContainer.setBackground(glassInputBackground());
    packageListContainer.setVisibility(View.GONE);
    targetModuleContainer.addView(packageListContainer, blockParams(0, 0, 0, 0));
    controlDetailsContainer.addView(targetModuleContainer, blockParams(0, 0, 0, 14));
    card.addView(controlDetailsContainer);

    updateScopeButtons();
    updateControlCollapseState();
    updateTargetConfirmationView();

    presetLabel = text("弱网预设", 13, MUTED, Typeface.NORMAL);
    card.addView(presetLabel, blockParams(0, 0, 0, 8));

    presetList = new LinearLayout(this);
    presetList.setOrientation(LinearLayout.VERTICAL);
    presetButtons = new Button[LOCAL_PRESETS.length];
    for (int index = 0; index < LOCAL_PRESETS.length; index += 2) {
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      addPresetButton(row, index, false);
      if (index + 1 < LOCAL_PRESETS.length) addPresetButton(row, index + 1, true);
      presetList.addView(row, blockParams(0, 0, 0, 8));
    }
    card.addView(presetList);
    card.addView(buildActions(), blockParams(0, 4, 0, 0));
    updatePresetButtons();
    return card;
  }

  private View buildScopeControls() {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    scopeSingleButton = buildScopeButton("单包", SCOPE_SINGLE);
    scopeGlobalButton = buildScopeButton("整机", SCOPE_GLOBAL);
    row.addView(scopeSingleButton, new LinearLayout.LayoutParams(0, dp(40), 1f));
    LinearLayout.LayoutParams globalParams = new LinearLayout.LayoutParams(0, dp(40), 1f);
    globalParams.setMargins(dp(8), 0, 0, 0);
    row.addView(scopeGlobalButton, globalParams);
    return row;
  }

  private Button buildScopeButton(String label, final String scope) {
    Button button = new Button(this);
    button.setText(label);
    button.setAllCaps(false);
    button.setTextSize(13);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setMinHeight(0);
    button.setMinimumHeight(0);
    button.setPadding(dp(4), 0, dp(4), 0);
    button.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        setTargetScope(scope);
      }
    });
    return button;
  }

  private Button buildControlCollapseButton() {
    Button button = new Button(this);
    button.setAllCaps(false);
    button.setTextSize(16);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setMinHeight(0);
    button.setMinimumHeight(0);
    button.setPadding(0, 0, 0, 0);
    button.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        controlCollapsed = !controlCollapsed;
        saveControlCollapsed(controlCollapsed);
        updateControlCollapseState();
      }
    });
    return button;
  }

  private void updateControlCollapseState() {
    if (controlDetailsContainer != null) {
      controlDetailsContainer.setVisibility(controlCollapsed ? View.GONE : View.VISIBLE);
    }
    if (controlCollapseButton != null) {
      controlCollapseButton.setText(controlCollapsed ? "▾" : "▴");
      controlCollapseButton.setContentDescription(controlCollapsed ? "展开配置" : "折叠配置");
      controlCollapseButton.setTextColor(buttonTextColors(false));
      controlCollapseButton.setBackground(buttonBackground(false));
      installButtonPressMotion(controlCollapseButton, true);
    }
    if (targetModuleContainer != null) {
      targetModuleContainer.setVisibility(!controlCollapsed && SCOPE_SINGLE.equals(targetScope) ? View.VISIBLE : View.GONE);
    }
    if (packageListContainer != null && (controlCollapsed || SCOPE_GLOBAL.equals(targetScope))) {
      packageListContainer.setVisibility(View.GONE);
    }
  }

  private void toggleViewMode() {
    StatusSnapshot snapshot = currentSnapshot == null ? readStatusSnapshot() : currentSnapshot;
    viewModeOverride = isHostControlView(snapshot) ? VIEW_LOCAL : VIEW_HOST;
    saveViewModeOverride(viewModeOverride);
    renderStatus(snapshot);
  }

  private void applyControlView(StatusSnapshot snapshot) {
    boolean hostView = isHostControlView(snapshot);
    if (headerSubtitle != null) {
      headerSubtitle.setText(hostView ? "电脑控制台下发" : "手机本地独立运行");
    }
    if (modeSwitchButton != null) {
      modeSwitchButton.setText(hostView ? "电脑" : "本机");
      modeSwitchButton.setContentDescription(hostView ? "切换到本机控制界面" : "切换到电脑下发界面");
      modeSwitchButton.setTextColor(buttonTextColors(false));
      modeSwitchButton.setBackground(buttonBackground(false));
      installButtonPressMotion(modeSwitchButton, true);
    }
    if (controlTitle != null) {
      controlTitle.setText(hostView ? "电脑下发" : "本地控制");
    }
    if (selectedPresetLabel != null) {
      selectedPresetLabel.setVisibility(hostView ? View.GONE : View.VISIBLE);
      if (!hostView) selectedPresetLabel.setText(LOCAL_PRESETS[selectedPresetIndex].scene);
    }
    if (controlCollapseButton != null) {
      controlCollapseButton.setVisibility(hostView ? View.GONE : View.VISIBLE);
    }
    if (hostControlInfo != null) {
      hostControlInfo.setVisibility(hostView ? View.VISIBLE : View.GONE);
      hostControlInfo.setText(getHostControlInfo(snapshot));
    }
    if (presetLabel != null) presetLabel.setVisibility(hostView ? View.GONE : View.VISIBLE);
    if (presetList != null) presetList.setVisibility(hostView ? View.GONE : View.VISIBLE);
    if (hostView) {
      if (controlDetailsContainer != null) controlDetailsContainer.setVisibility(View.GONE);
      if (targetModuleContainer != null) targetModuleContainer.setVisibility(View.GONE);
      if (packageListContainer != null) packageListContainer.setVisibility(View.GONE);
      return;
    }
    updateControlCollapseState();
  }

  private String getHostControlInfo(StatusSnapshot snapshot) {
    String endpoint = "";
    if (snapshot != null && (!isEmpty(snapshot.socksHost) || snapshot.socksPort > 0)) {
      endpoint = "\nSOCKS 出口：" + firstNonEmpty(snapshot.socksHost, "unknown") + ":" + snapshot.socksPort;
    }
    if (snapshot != null && snapshot.running) {
      return "当前由电脑控制台下发。APK 只显示状态、VPN 授权和清除弱网，不在此界面应用本机预设。" + endpoint;
    }
    return "电脑下发界面会隐藏本机预设和包名选择。需要独立运行时，点击顶部小按钮切到本机界面。";
  }

  private boolean isHostControlView(StatusSnapshot snapshot) {
    String mode = normalizeViewMode(viewModeOverride);
    if (VIEW_HOST.equals(mode)) return true;
    if (VIEW_LOCAL.equals(mode)) return false;
    return isHostSocksSnapshot(snapshot);
  }

  private boolean isHostSocksSnapshot(StatusSnapshot snapshot) {
    if (snapshot == null) return false;
    if (DATAPLANE_HOST_SOCKS.equals(snapshot.dataplane)) return true;
    return "socks".equals(snapshot.mode) && !DATAPLANE_ANDROID_LOCAL.equals(snapshot.dataplane);
  }

  private void setTargetScope(String scope) {
    targetScope = normalizeTargetScope(scope);
    saveTargetScope(targetScope);
    if (SCOPE_SINGLE.equals(targetScope)) {
      String packageName = getConfirmedTargetPackage();
      if (isEmpty(packageName)) packageName = getInputTargetPackage();
      setTargetInputText(packageName);
    } else {
      setTargetInputText("");
      if (packageListContainer != null) packageListContainer.setVisibility(View.GONE);
    }
    updateScopeButtons();
    updateTargetConfirmationView();
    renderStatus(readStatusSnapshot());
  }

  private void updateScopeButtons() {
    styleScopeButton(scopeSingleButton, SCOPE_SINGLE.equals(targetScope));
    styleScopeButton(scopeGlobalButton, SCOPE_GLOBAL.equals(targetScope));
    if (targetPackageInput != null) {
      targetPackageInput.setEnabled(!SCOPE_GLOBAL.equals(targetScope));
      targetPackageInput.setHint("例如 com.ffm.global");
    }
    if (selectPackageButton != null) {
      selectPackageButton.setEnabled(!SCOPE_GLOBAL.equals(targetScope));
      selectPackageButton.setText("选择应用");
    }
    if (confirmTargetButton != null) {
      confirmTargetButton.setEnabled(!SCOPE_GLOBAL.equals(targetScope));
    }
    if (targetModuleContainer != null) {
      targetModuleContainer.setVisibility(SCOPE_GLOBAL.equals(targetScope) ? View.GONE : View.VISIBLE);
    }
    if (scopeHintView != null) {
      if (SCOPE_GLOBAL.equals(targetScope)) {
        scopeHintView.setText("整机模式会接管手机除弱网代理自身外的全部流量，适合验证 100% 丢包是否彻底生效。");
      } else {
        scopeHintView.setText("单包模式只控制确认的目标包名，风险最低，但无法覆盖其他包代发的请求。");
      }
    }
    updateControlCollapseState();
  }

  private void styleScopeButton(Button button, boolean selected) {
    if (button == null) return;
    button.setTextColor(buttonTextColors(selected));
    button.setBackground(buttonBackground(selected));
    installButtonPressMotion(button, true);
  }

  private void addPresetButton(LinearLayout row, final int index, boolean withLeftMargin) {
    Button button = new Button(this);
    button.setAllCaps(false);
    button.setTextSize(14);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setMinHeight(0);
    button.setMinimumHeight(0);
    button.setPadding(dp(6), 0, dp(6), 0);
    button.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        selectedPresetIndex = index;
        updatePresetButtons();
        renderStatus(readStatusSnapshot());
      }
    });
    presetButtons[index] = button;
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(42), 1f);
    if (withLeftMargin) params.setMargins(dp(8), 0, 0, 0);
    row.addView(button, params);
  }

  private void updatePresetButtons() {
    if (presetButtons == null) return;
    for (int index = 0; index < presetButtons.length; index++) {
      Button button = presetButtons[index];
      if (button == null) continue;
      Preset preset = LOCAL_PRESETS[index];
      boolean selected = index == selectedPresetIndex;
      button.setText(preset.name);
      button.setTextColor(buttonTextColors(selected));
      button.setBackground(buttonBackground(selected));
      installButtonPressMotion(button, true);
    }
    if (selectedPresetLabel != null) {
      selectedPresetLabel.setText(LOCAL_PRESETS[selectedPresetIndex].scene);
    }
  }

  private void togglePackageList() {
    if (packageListContainer == null) return;
    if (controlCollapsed) return;
    if (SCOPE_GLOBAL.equals(targetScope)) return;
    if (packageListContainer.getVisibility() == View.VISIBLE) {
      packageListContainer.setVisibility(View.GONE);
      return;
    }
    renderPackageList();
    packageListContainer.setVisibility(View.VISIBLE);
  }

  private void renderPackageList() {
    if (packageListContainer == null) return;
    packageListContainer.removeAllViews();
    List<AppCandidate> candidates = getOpenAppCandidates();
    if (candidates.isEmpty()) {
      TextView empty = text("未读取到当前运行应用", 13, MUTED, Typeface.BOLD);
      empty.setGravity(Gravity.CENTER);
      packageListContainer.addView(empty, blockParams(0, 0, 0, 8));
      if (!hasUsageStatsAccess()) {
        Button usageButton = new Button(this);
        usageButton.setText("授权最近应用列表");
        styleButton(usageButton, false, true);
        usageButton.setOnClickListener(new View.OnClickListener() {
          @Override
          public void onClick(View view) {
            startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
          }
        });
        packageListContainer.addView(usageButton, blockParams(0, 0, 0, 4, LinearLayout.LayoutParams.MATCH_PARENT, dp(38)));
      }
      return;
    }

    int count = Math.min(candidates.size(), 14);
    for (int index = 0; index < count; index++) {
      final AppCandidate candidate = candidates.get(index);
      Button packageButton = new Button(this);
      packageButton.setText(candidate.packageName);
      packageButton.setAllCaps(false);
      packageButton.setTextSize(12);
      packageButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
      packageButton.setGravity(Gravity.CENTER_VERTICAL | Gravity.LEFT);
      packageButton.setPadding(dp(10), 0, dp(10), 0);
      packageButton.setSingleLine(true);
      packageButton.setTextColor(buttonTextColors(false));
      packageButton.setBackground(buttonBackground(false));
      installButtonPressMotion(packageButton, true);
      packageButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          setTargetInputText(candidate.packageName);
          packageListContainer.setVisibility(View.GONE);
        }
      });
      packageListContainer.addView(packageButton, blockParams(0, 0, 0, 6, LinearLayout.LayoutParams.MATCH_PARENT, dp(38)));
    }
  }

  private void setTargetInputText(String packageName) {
    if (targetPackageInput == null) return;
    targetTextChangeInternal = true;
    targetPackageInput.setText(packageName);
    targetPackageInput.setSelection(packageName.length());
    targetTextChangeInternal = false;
    updateTargetConfirmationView();
  }

  private void confirmTargetPackage() {
    if (SCOPE_GLOBAL.equals(targetScope)) {
      confirmedTargetPackage = "";
      saveTargetScope(targetScope);
      saveTargetPackage("");
      updateTargetConfirmationView();
      StatusSnapshot snapshot = StatusSnapshot.local("idle", "已确认控制范围：整机流量。", isVpnPermissionGranted());
      snapshot.dataplane = "android-local";
      snapshot.targetScope = targetScope;
      snapshot.targetPackage = getTargetDisplayText();
      renderStatus(snapshot);
      return;
    }

    String targetPackage = getInputTargetPackage();
    if (!isValidPackageName(targetPackage)) {
      renderPackageError("请输入合法目标包名，例如 com.ffm.global。");
      return;
    }
    if (!isTargetPackageInstalled(targetPackage)) {
      renderPackageError("当前设备没有安装 " + targetPackage + "。");
      return;
    }
    confirmedTargetPackage = targetPackage;
    saveTargetScope(targetScope);
    saveTargetPackage(targetPackage);
    updateTargetConfirmationView();
    StatusSnapshot snapshot = StatusSnapshot.local("idle", "已确认目标包名：" + targetPackage + "。", isVpnPermissionGranted());
    snapshot.dataplane = "android-local";
    snapshot.targetScope = targetScope;
    snapshot.targetPackage = targetPackage;
    renderStatus(snapshot);
  }

  private void renderPackageError(String message) {
    StatusSnapshot snapshot = StatusSnapshot.local("error", message, isVpnPermissionGranted());
    snapshot.dataplane = "android-local";
    snapshot.targetScope = targetScope;
    snapshot.targetPackage = getTargetDisplayText();
    renderStatus(snapshot);
  }

  private String getInputTargetPackage() {
    return targetPackageInput == null ? "" : targetPackageInput.getText().toString().trim();
  }

  private String getConfirmedTargetPackage() {
    return confirmedTargetPackage == null ? "" : confirmedTargetPackage.trim();
  }

  private void updateTargetConfirmationView() {
    if (confirmedPackageView == null) return;
    if (SCOPE_GLOBAL.equals(targetScope)) {
      confirmedPackageView.setText("整机");
      confirmedPackageView.setTextColor(GREEN_DARK);
      return;
    }
    String input = getInputTargetPackage();
    String confirmed = getConfirmedTargetPackage();
    if (isEmpty(confirmed)) {
      confirmedPackageView.setText("未确认");
      confirmedPackageView.setTextColor(MUTED);
    } else if (confirmed.equals(input)) {
      confirmedPackageView.setText("已确认");
      confirmedPackageView.setTextColor(GREEN_DARK);
    } else {
      confirmedPackageView.setText("待确认");
      confirmedPackageView.setTextColor(AMBER);
    }
  }

  private List<AppCandidate> getOpenAppCandidates() {
    final long now = System.currentTimeMillis();
    final Map<String, AppCandidate> candidates = new LinkedHashMap<String, AppCandidate>();
    addRunningAppCandidates(candidates, now);
    addUsageStatsCandidates(candidates, now);
    List<AppCandidate> result = new ArrayList<AppCandidate>(candidates.values());
    Collections.sort(result, new Comparator<AppCandidate>() {
      @Override
      public int compare(AppCandidate left, AppCandidate right) {
        if (left.running != right.running) return left.running ? -1 : 1;
        if (left.lastUsedAt != right.lastUsedAt) return left.lastUsedAt > right.lastUsedAt ? -1 : 1;
        return left.packageName.compareTo(right.packageName);
      }
    });
    return result;
  }

  private void addRunningAppCandidates(Map<String, AppCandidate> candidates, long now) {
    ActivityManager manager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
    if (manager == null) return;
    List<ActivityManager.RunningAppProcessInfo> processes = manager.getRunningAppProcesses();
    if (processes == null) return;
    for (ActivityManager.RunningAppProcessInfo process : processes) {
      if (process == null || process.pkgList == null) continue;
      for (String packageName : process.pkgList) {
        addAppCandidate(candidates, packageName, now, true);
      }
    }
  }

  private void addUsageStatsCandidates(Map<String, AppCandidate> candidates, long now) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP || !hasUsageStatsAccess()) return;
    UsageStatsManager manager = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
    if (manager == null) return;
    List<UsageStats> stats = manager.queryUsageStats(
      UsageStatsManager.INTERVAL_DAILY,
      now - 8L * 60L * 60L * 1000L,
      now
    );
    if (stats == null) return;
    for (UsageStats item : stats) {
      if (item == null || item.getLastTimeUsed() <= 0) continue;
      addAppCandidate(candidates, item.getPackageName(), item.getLastTimeUsed(), false);
    }
  }

  private void addAppCandidate(Map<String, AppCandidate> candidates, String packageName, long lastUsedAt, boolean running) {
    if (!isValidPackageName(packageName)) return;
    if (getPackageName().equals(packageName)) return;
    if (!isTargetPackageInstalled(packageName)) return;
    AppCandidate existing = candidates.get(packageName);
    if (existing == null) {
      candidates.put(packageName, new AppCandidate(packageName, lastUsedAt, running));
      return;
    }
    existing.running = existing.running || running;
    existing.lastUsedAt = Math.max(existing.lastUsedAt, lastUsedAt);
  }

  private boolean hasUsageStatsAccess() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return false;
    AppOpsManager manager = (AppOpsManager) getSystemService(APP_OPS_SERVICE);
    if (manager == null) return false;
    int mode = manager.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      getPackageName()
    );
    return mode == AppOpsManager.MODE_ALLOWED;
  }

  private View buildStatusCard() {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(18), dp(18), dp(18), dp(18));
    card.setBackground(glassStatusCardBackground());

    statusHeader = new LinearLayout(this);
    statusHeader.setOrientation(LinearLayout.VERTICAL);
    statusHeader.setPadding(dp(14), dp(13), dp(14), dp(13));
    statusHeader.setBackground(glassTintBackground(BLUE_BG, BLUE_LINE, 8));

    LinearLayout metaRow = new LinearLayout(this);
    metaRow.setOrientation(LinearLayout.HORIZONTAL);
    metaRow.setGravity(Gravity.CENTER_VERTICAL);

    stateLabel = text("", 13, GREEN_DARK, Typeface.BOLD);
    metaRow.addView(stateLabel, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

    stateLiveView = text("", 12, GREEN_DARK, Typeface.BOLD);
    stateLiveView.setGravity(Gravity.RIGHT);
    metaRow.addView(stateLiveView);
    statusHeader.addView(metaRow, blockParams(0, 0, 0, 8));

    LinearLayout titleRow = new LinearLayout(this);
    titleRow.setOrientation(LinearLayout.HORIZONTAL);
    titleRow.setGravity(Gravity.CENTER_VERTICAL);

    stateTitle = text("", 24, TEXT, Typeface.BOLD);
    stateTitle.setLineSpacing(0, 1.05f);
    titleRow.addView(stateTitle, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

    stateBadge = text("", 13, GREEN_DARK, Typeface.BOLD);
    stateBadge.setGravity(Gravity.CENTER);
    stateBadge.setPadding(dp(10), dp(7), dp(10), dp(7));
    LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    badgeParams.setMargins(dp(10), 0, 0, 0);
    titleRow.addView(stateBadge, badgeParams);
    statusHeader.addView(titleRow, blockParams(0, 0, 0, 9));

    stateDescription = text("", 14, MUTED, Typeface.NORMAL);
    stateDescription.setLineSpacing(0, 1.25f);
    statusHeader.addView(stateDescription);
    card.addView(statusHeader);

    View divider = new View(this);
    divider.setBackgroundColor(LINE);
    card.addView(divider, blockParams(0, 16, 0, 15, LinearLayout.LayoutParams.MATCH_PARENT, 1));

    targetValue = addFactRow(card, "目标应用");
    linkValue = addFactRow(card, "链路");
    updatedValue = addFactRow(card, "更新时间");
    statsTcpValue = addFactRow(card, "TCP");
    statsTrafficValue = addFactRow(card, "流量");
    statsDropValue = addFactRow(card, "弱网命中");

    return card;
  }

  private View buildNoticeCard() {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(14), dp(13), dp(14), dp(13));
    card.setBackground(glassNoticeBackground());

    noticeTitle = text("不要开启系统“始终开启的 VPN”", 14, AMBER, Typeface.BOLD);
    card.addView(noticeTitle, blockParams(0, 0, 0, 6));

    noticeBody = text("否则清除弱网后，手机可能自动拉起 VPN，导致状态和真实网络不一致。", 13, TEXT, Typeface.NORMAL);
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
    card.setBackground(glassDiagnosticsBackground());

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
    diagnosticsBody.setBackground(glassInputBackground());
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
    if (requestCode == VPN_PERMISSION_REQUEST) {
      boolean shouldApply = pendingApplyAfterPermission;
      pendingApplyAfterPermission = false;
      if (shouldApply && isVpnPermissionGranted()) {
        applySelectedPreset();
        return;
      }
      refreshStatus();
    }
  }

  private void startServiceCompat(Intent intent) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(intent);
    } else {
      startService(intent);
    }
  }

  private void stopWeaknet() {
    selectedPresetIndex = 0;
    updatePresetButtons();
    Intent intent = new Intent(MainActivity.this, WeaknetVpnService.class);
    intent.setAction(WeaknetVpnService.ACTION_STOP);
    startServiceCompat(intent);
    renderStatus(StatusSnapshot.local("normal", "已发送清除手机端弱网命令。", isVpnPermissionGranted()));
    primaryButton.postDelayed(new Runnable() {
      @Override
      public void run() {
        refreshStatus();
      }
    }, 700);
  }

  private void applySelectedPreset() {
    if (!isVpnPermissionGranted()) {
      pendingApplyAfterPermission = true;
      requestVpnPermission();
      return;
    }

    Preset preset = getSelectedPreset();
    if ("normal".equals(preset.presetKey)) {
      stopWeaknet();
      return;
    }

    if (SCOPE_GLOBAL.equals(targetScope)) {
      saveTargetScope(targetScope);
    } else {
      String inputTargetPackage = getInputTargetPackage();
      String targetPackage = getConfirmedTargetPackage();
      if (!isValidPackageName(inputTargetPackage)) {
        StatusSnapshot snapshot = StatusSnapshot.local(
          "error",
          "请输入合法目标包名，例如 com.ffm.global。弱网只会作用到这个应用。",
          true
        );
        snapshot.dataplane = "android-local";
        snapshot.targetScope = targetScope;
        snapshot.presetKey = preset.presetKey;
        snapshot.displayName = preset.name;
        renderStatus(snapshot);
        return;
      }

      if (isEmpty(targetPackage) || !targetPackage.equals(inputTargetPackage)) {
        StatusSnapshot snapshot = StatusSnapshot.local(
          "error",
          "请先点击 ✓ 确认目标包名，然后再应用弱网。",
          true
        );
        snapshot.dataplane = "android-local";
        snapshot.targetScope = targetScope;
        snapshot.presetKey = preset.presetKey;
        snapshot.displayName = preset.name;
        snapshot.targetPackage = inputTargetPackage;
        renderStatus(snapshot);
        return;
      }

      if (!isTargetPackageInstalled(targetPackage)) {
        StatusSnapshot snapshot = StatusSnapshot.local(
          "error",
          "当前设备没有安装 " + targetPackage + "。请填写真实测试 App 的包名。",
          true
        );
        snapshot.dataplane = "android-local";
        snapshot.targetScope = targetScope;
        snapshot.presetKey = preset.presetKey;
        snapshot.displayName = preset.name;
        snapshot.targetPackage = targetPackage;
        renderStatus(snapshot);
        return;
      }
    }

    String targetPackage = SCOPE_GLOBAL.equals(targetScope) ? "" : getConfirmedTargetPackage();
    if (!SCOPE_GLOBAL.equals(targetScope)) {
      saveTargetPackage(targetPackage);
    }
    Intent intent = new Intent(MainActivity.this, WeaknetVpnService.class);
    intent.setAction(WeaknetVpnService.ACTION_APPLY);
    intent.putExtra("profile", buildProfileJson(preset, targetPackage));
    intent.putExtra("targetPackage", targetPackage);
    startServiceCompat(intent);

    StatusSnapshot snapshot = StatusSnapshot.local("local", "正在本地应用弱网：" + preset.name + "。", true);
    snapshot.running = true;
    snapshot.dataplane = "android-local";
    snapshot.targetScope = targetScope;
    snapshot.presetKey = preset.presetKey;
    snapshot.displayName = preset.name;
    snapshot.targetPackage = getTargetDisplayText();
    renderStatus(snapshot);
    refreshHandler.postDelayed(new Runnable() {
      @Override
      public void run() {
        refreshStatus();
      }
    }, 900);
  }

  private Preset getSelectedPreset() {
    if (selectedPresetIndex < 0 || selectedPresetIndex >= LOCAL_PRESETS.length) selectedPresetIndex = 2;
    return LOCAL_PRESETS[selectedPresetIndex];
  }

  private String loadTargetPackage() {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(PREF_TARGET_PACKAGE, "");
  }

  private boolean loadControlCollapsed() {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(PREF_CONTROL_COLLAPSED, false);
  }

  private void saveControlCollapsed(boolean collapsed) {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putBoolean(PREF_CONTROL_COLLAPSED, collapsed)
      .apply();
  }

  private String loadViewModeOverride() {
    return normalizeViewMode(getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(PREF_VIEW_MODE, VIEW_AUTO));
  }

  private void saveViewModeOverride(String mode) {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putString(PREF_VIEW_MODE, normalizeViewMode(mode))
      .apply();
  }

  private String normalizeViewMode(String mode) {
    if (VIEW_HOST.equals(mode)) return VIEW_HOST;
    if (VIEW_LOCAL.equals(mode)) return VIEW_LOCAL;
    return VIEW_AUTO;
  }

  private void clearLegacyMultiPackagePrefs() {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .remove(PREF_LEGACY_TARGET_PACKAGES)
      .apply();
  }

  private String loadThemeKey() {
    return normalizeThemeKey(getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(PREF_THEME, THEME_TERMINAL_AURORA));
  }

  private boolean syncThemeFromPrefs() {
    String nextTheme = loadThemeKey();
    if (nextTheme.equals(currentThemeKey)) return false;
    currentThemeKey = nextTheme;
    applyThemePalette(currentThemeKey);
    recreate();
    return true;
  }

  private String normalizeThemeKey(String theme) {
    if (THEME_CYBER.equals(theme)) return THEME_CYBER;
    if (THEME_CLASSIC.equals(theme)) return THEME_CLASSIC;
    return THEME_TERMINAL_AURORA;
  }

  private void applyThemePalette(String theme) {
    String key = normalizeThemeKey(theme);
    if (THEME_CYBER.equals(key)) {
      BG = Color.rgb(3, 11, 12);
      SURFACE = Color.rgb(12, 23, 25);
      SURFACE_MUTED = Color.rgb(7, 17, 19);
      TEXT = Color.rgb(234, 255, 251);
      MUTED = Color.rgb(145, 180, 179);
      LINE = Color.rgb(27, 76, 75);
      GREEN = Color.rgb(115, 245, 139);
      GREEN_DARK = Color.rgb(115, 245, 139);
      GREEN_SOFT = Color.rgb(7, 31, 25);
      AMBER = Color.rgb(255, 195, 107);
      AMBER_BG = Color.rgb(54, 41, 17);
      AMBER_LINE = Color.rgb(113, 83, 38);
      BLUE = Color.rgb(69, 230, 208);
      BLUE_BG = Color.rgb(9, 33, 35);
      BLUE_LINE = Color.rgb(45, 112, 107);
      RED = Color.rgb(255, 118, 109);
      RED_BG = Color.rgb(60, 24, 23);
      RED_LINE = Color.rgb(132, 51, 48);
      PRIMARY_TEXT = Color.rgb(239, 255, 245);
      PRIMARY_PRESSED = Color.rgb(38, 147, 88);
      PAGE_TOP = Color.rgb(7, 20, 20);
      PAGE_MID = Color.rgb(3, 16, 17);
      PAGE_BOTTOM = Color.rgb(2, 7, 7);
      GLASS_TOP = Color.argb(238, 9, 23, 25);
      GLASS_BOTTOM = Color.argb(244, 4, 12, 13);
      GLASS_MUTED_TOP = Color.argb(214, 9, 25, 27);
      GLASS_MUTED_BOTTOM = Color.argb(232, 6, 16, 18);
      PRIMARY_TOP = Color.rgb(38, 147, 88);
      PRIMARY_BOTTOM = Color.rgb(13, 103, 69);
      PRIMARY_PRESSED_TOP = Color.rgb(54, 178, 108);
      PRIMARY_PRESSED_BOTTOM = Color.rgb(18, 124, 82);
      return;
    }
    if (THEME_CLASSIC.equals(key)) {
      BG = Color.rgb(243, 246, 248);
      SURFACE = Color.WHITE;
      SURFACE_MUTED = Color.rgb(247, 249, 251);
      TEXT = Color.rgb(22, 32, 38);
      MUTED = Color.rgb(97, 113, 125);
      LINE = Color.rgb(220, 228, 233);
      GREEN = Color.rgb(8, 116, 67);
      GREEN_DARK = Color.rgb(8, 116, 67);
      GREEN_SOFT = Color.rgb(231, 247, 239);
      AMBER = Color.rgb(155, 90, 0);
      AMBER_BG = Color.rgb(255, 244, 215);
      AMBER_LINE = Color.rgb(238, 210, 137);
      BLUE = Color.rgb(8, 127, 140);
      BLUE_BG = Color.rgb(230, 246, 248);
      BLUE_LINE = Color.rgb(183, 224, 230);
      RED = Color.rgb(180, 35, 24);
      RED_BG = Color.rgb(255, 235, 232);
      RED_LINE = Color.rgb(244, 187, 181);
      PRIMARY_TEXT = Color.WHITE;
      PRIMARY_PRESSED = Color.rgb(6, 101, 59);
      PAGE_TOP = Color.rgb(243, 246, 248);
      PAGE_MID = Color.rgb(232, 246, 248);
      PAGE_BOTTOM = Color.rgb(248, 242, 232);
      GLASS_TOP = Color.argb(246, 255, 255, 255);
      GLASS_BOTTOM = Color.argb(238, 247, 249, 251);
      GLASS_MUTED_TOP = Color.argb(246, 255, 255, 255);
      GLASS_MUTED_BOTTOM = Color.argb(236, 240, 246, 248);
      PRIMARY_TOP = Color.rgb(10, 144, 102);
      PRIMARY_BOTTOM = Color.rgb(8, 116, 67);
      PRIMARY_PRESSED_TOP = Color.rgb(9, 125, 84);
      PRIMARY_PRESSED_BOTTOM = Color.rgb(6, 101, 59);
      return;
    }

    BG = Color.rgb(16, 24, 32);
    SURFACE = Color.rgb(20, 34, 43);
    SURFACE_MUTED = Color.rgb(13, 24, 31);
    TEXT = Color.rgb(233, 251, 251);
    MUTED = Color.rgb(146, 173, 182);
    LINE = Color.rgb(47, 86, 93);
    GREEN = Color.rgb(85, 240, 221);
    GREEN_DARK = Color.rgb(139, 240, 143);
    GREEN_SOFT = Color.rgb(14, 55, 55);
    AMBER = Color.rgb(255, 195, 107);
    AMBER_BG = Color.rgb(61, 45, 19);
    AMBER_LINE = Color.rgb(123, 91, 42);
    BLUE = Color.rgb(68, 226, 209);
    BLUE_BG = Color.rgb(16, 45, 58);
    BLUE_LINE = Color.rgb(63, 124, 130);
    RED = Color.rgb(255, 116, 109);
    RED_BG = Color.rgb(64, 25, 27);
    RED_LINE = Color.rgb(139, 55, 58);
    PRIMARY_TEXT = Color.rgb(6, 24, 26);
    PRIMARY_PRESSED = Color.rgb(117, 247, 231);
    PAGE_TOP = Color.rgb(17, 28, 36);
    PAGE_MID = Color.rgb(16, 24, 32);
    PAGE_BOTTOM = Color.rgb(13, 21, 27);
    GLASS_TOP = Color.argb(240, 20, 34, 43);
    GLASS_BOTTOM = Color.argb(242, 13, 25, 32);
    GLASS_MUTED_TOP = Color.argb(218, 15, 31, 39);
    GLASS_MUTED_BOTTOM = Color.argb(232, 10, 22, 29);
    PRIMARY_TOP = Color.rgb(85, 240, 221);
    PRIMARY_BOTTOM = Color.rgb(22, 169, 158);
    PRIMARY_PRESSED_TOP = Color.rgb(117, 247, 231);
    PRIMARY_PRESSED_BOTTOM = Color.rgb(31, 192, 179);
  }

  private String loadTargetScope() {
    return normalizeTargetScope(getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(PREF_TARGET_SCOPE, SCOPE_SINGLE));
  }

  private void saveTargetScope(String scope) {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putString(PREF_TARGET_SCOPE, normalizeTargetScope(scope))
      .apply();
  }

  private void saveTargetPackage(String targetPackage) {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putString(PREF_TARGET_PACKAGE, targetPackage)
      .apply();
  }

  private String normalizeTargetScope(String scope) {
    if (SCOPE_GLOBAL.equals(scope)) return SCOPE_GLOBAL;
    return SCOPE_SINGLE;
  }

  private String getInputTextForScope() {
    if (SCOPE_GLOBAL.equals(targetScope)) return "";
    return confirmedTargetPackage;
  }

  private String getTargetDisplayText() {
    if (SCOPE_GLOBAL.equals(targetScope)) return "整机流量";
    return firstNonEmpty(getConfirmedTargetPackage(), getInputTargetPackage(), "未指定");
  }

  private String buildProfileJson(Preset preset, String targetPackage) {
    JSONObject json = new JSONObject();
    try {
      json.put("presetKey", preset.presetKey);
      json.put("dataplane", "android-local");
      json.put("targetScope", targetScope);
      json.put("theme", currentThemeKey);
      json.put("displayName", preset.name);
      json.put("displayNameZh", preset.name);
      json.put("targetPackage", SCOPE_GLOBAL.equals(targetScope) ? "" : targetPackage);
      json.put("latencyRttMs", preset.latencyRttMs == null ? JSONObject.NULL : preset.latencyRttMs);
      json.put("jitterMs", preset.jitterMs == null ? JSONObject.NULL : preset.jitterMs);
      json.put("packetLossPercent", preset.packetLossPercent);
      json.put("downloadKbps", preset.downloadKbps == null ? JSONObject.NULL : preset.downloadKbps);
      json.put("uploadKbps", preset.uploadKbps == null ? JSONObject.NULL : preset.uploadKbps);
      json.put("disconnectMode", preset.disconnectMode);
      json.put("disconnectDurationSec", preset.disconnectDurationSec);
      json.put("disconnectIntervalSec", preset.disconnectIntervalSec);
      JSONObject networkWave = new JSONObject();
      networkWave.put("enabled", preset.networkWaveEnabled);
      networkWave.put("mode", "subway-elevator");
      json.put("networkWave", networkWave);
    } catch (Exception ignored) {
    }
    return json.toString();
  }

  private void refreshStatus() {
    if (syncThemeFromPrefs()) return;
    renderStatus(readStatusSnapshot());
  }

  private StatusSnapshot readStatusSnapshot() {
    boolean permissionGranted = isVpnPermissionGranted();
    File file = new File(getFilesDir(), WeaknetVpnService.STATUS_FILE_NAME);
    if (!file.exists()) {
      if (permissionGranted) {
        return StatusSnapshot.local("idle", "VPN 权限已授权，但 VPN 还没有启动。", true);
      }
      return StatusSnapshot.local("needs_permission", "暂无状态。请先授权 VPN，然后在本页选择包名和弱网预设。", false);
    }
    try (FileInputStream input = new FileInputStream(file)) {
      byte[] bytes = new byte[(int) file.length()];
      int read = input.read(bytes);
      if (read <= 0) return StatusSnapshot.local("error", "状态文件为空。", permissionGranted);
      StatusSnapshot snapshot = StatusSnapshot.fromJson(new String(bytes, 0, read, "UTF-8"), permissionGranted);
      if ("needs_permission".equals(snapshot.mode) && permissionGranted) {
        snapshot.mode = "idle";
        snapshot.running = false;
        snapshot.message = "上一次下发停在未授权状态；现在可在本页直接点击“应用本地弱网”。";
      }
      return snapshot;
    } catch (IOException error) {
      return StatusSnapshot.local("error", "无法读取状态：" + error.getMessage(), permissionGranted);
    }
  }

  private void renderStatus(StatusSnapshot snapshot) {
    currentSnapshot = snapshot;
    if (snapshot == null) snapshot = StatusSnapshot.local("error", "状态未知。", isVpnPermissionGranted());
    syncViewModeWithActualState(snapshot);

    int accent = getAccent(snapshot);
    vpnPill.setText(getVpnPillText(snapshot));
    vpnPill.setTextColor(accent);
    vpnPill.setBackground(glassTintBackground(getAccentSoft(snapshot), getAccentLine(snapshot), 999));

    if (statusHeader != null) {
      statusHeader.setBackground(glassTintBackground(getStatusHeaderFill(snapshot), getStatusHeaderStroke(snapshot), 8));
    }
    stateLabel.setText(getStateLabel(snapshot));
    stateLabel.setTextColor(accent);
    if (stateLiveView != null) {
      stateLiveView.setText(getLiveStatusText(snapshot));
      stateLiveView.setTextColor(accent);
    }
    stateTitle.setText(getStateTitle(snapshot));
    stateTitle.setTextColor(getStatusHeaderText(snapshot));
    stateDescription.setText(getStateDescription(snapshot));
    stateDescription.setTextColor(getStatusHeaderMuted(snapshot));

    stateBadge.setText(getStateBadge(snapshot));
    stateBadge.setTextColor(accent);
    stateBadge.setBackground(glassTintBackground(getAccentSoft(snapshot), getAccentLine(snapshot), 999));

    targetValue.setText(getSnapshotTargetText(snapshot));
    linkValue.setText(getLinkText(snapshot));
    updatedValue.setText(formatUpdatedAt(snapshot.updatedAt) + " · " + formatRelativeAge(snapshot.updatedAt));
    statsTcpValue.setText(getTcpStatsText(snapshot));
    statsTrafficValue.setText(getTrafficStatsText(snapshot));
    statsDropValue.setText(getWeaknetHitText(snapshot));

    applyControlView(snapshot);
    configureNotice(snapshot);
    configureActions(snapshot);
    renderDiagnostics(snapshot);
    nextStepView.setText(getNextStep(snapshot));
  }

  private void syncViewModeWithActualState(StatusSnapshot snapshot) {
    String actualKey = getActualViewKey(snapshot);
    if (actualKey.equals(lastActualViewKey)) return;
    lastActualViewKey = actualKey;
    if (!VIEW_AUTO.equals(viewModeOverride)) {
      viewModeOverride = VIEW_AUTO;
      saveViewModeOverride(viewModeOverride);
    }
  }

  private String getActualViewKey(StatusSnapshot snapshot) {
    if (isHostSocksSnapshot(snapshot)) return VIEW_HOST;
    if (snapshot != null && (snapshot.running || DATAPLANE_ANDROID_LOCAL.equals(snapshot.dataplane) || "local".equals(snapshot.mode))) {
      return VIEW_LOCAL;
    }
    return "idle";
  }

  private void configureNotice(StatusSnapshot snapshot) {
    if (isHostControlView(snapshot)) {
      if ("needs_permission".equals(snapshot.mode)) {
        noticeTitle.setText("电脑下发需要 VPN 授权");
        noticeBody.setText("请先在手机上完成系统 VPN 授权，然后回到电脑控制台重新应用 Android VPN Agent 预设。");
        return;
      }
      noticeTitle.setText("电脑下发模式");
      noticeBody.setText("当前界面只展示电脑控制台下发的状态，并保留清除弱网。需要脱离电脑运行时，点击顶部小按钮切回本机控制。");
      return;
    }
    if ("needs_permission".equals(snapshot.mode)) {
      noticeTitle.setText("先完成一次 VPN 授权");
      noticeBody.setText("授权后可直接在本页选择目标包名和弱网预设。不要在系统 VPN 设置中开启“始终开启的 VPN”。");
      return;
    }
    noticeTitle.setText("不要开启系统“始终开启的 VPN”");
    noticeBody.setText("否则清除弱网后，手机可能自动拉起 VPN，导致状态和真实网络不一致。");
  }

  private void configureActions(final StatusSnapshot snapshot) {
    if (isHostControlView(snapshot)) {
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
        styleButton(primaryButton, true, true);
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
      primaryButton.setEnabled(true);
      styleButton(primaryButton, false, true);
      primaryButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          refreshStatus();
        }
      });

      secondaryButton.setText("清除弱网");
      secondaryButton.setEnabled(true);
      styleButton(secondaryButton, true, true);
      secondaryButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          stopWeaknet();
        }
      });
      return;
    }

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
      styleButton(primaryButton, true, true);
      styleButton(secondaryButton, false, true);
      secondaryButton.setOnClickListener(new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          refreshStatus();
        }
      });
      return;
    }

    final Preset preset = getSelectedPreset();
    primaryButton.setText("应用预设");
    primaryButton.setEnabled(true);
    styleButton(primaryButton, true, true);
    primaryButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        applySelectedPreset();
      }
    });

    secondaryButton.setText("清除弱网");
    secondaryButton.setEnabled(true);
    styleButton(secondaryButton, false, true);
    secondaryButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        stopWeaknet();
      }
    });
  }

  private void renderDiagnostics(StatusSnapshot snapshot) {
    diagnosticsToggle.setText(diagnosticsExpanded ? "收起" : "展开");
    diagnosticsBody.setVisibility(diagnosticsExpanded ? View.VISIBLE : View.GONE);
    diagnosticsBody.removeAllViews();
    if (!diagnosticsExpanded || snapshot == null) return;

    addDiagnosticRow("mode", firstNonEmpty(snapshot.mode, "unknown"));
    addDiagnosticRow("viewMode", isHostControlView(snapshot) ? "host" : "local");
    addDiagnosticRow("dataplane", firstNonEmpty(snapshot.dataplane, "unknown"));
    addDiagnosticRow("presetKey", firstNonEmpty(snapshot.presetKey, "none"));
    addDiagnosticRow("targetScope", firstNonEmpty(snapshot.targetScope, "single"));
    addDiagnosticRow("targetPackage", firstNonEmpty(snapshot.targetPackage, "none"));
    if (!isEmpty(snapshot.socksHost) || snapshot.socksPort > 0) {
      addDiagnosticRow("SOCKS 出口", firstNonEmpty(snapshot.socksHost, "unknown") + ":" + snapshot.socksPort);
    }
    if (hasLocalStats(snapshot)) {
      addDiagnosticRow("本地 TCP", "active=" + snapshot.localTcpActive + ", accepted=" + snapshot.localTcpAccepted + ", failed=" + snapshot.localTcpConnectFailed);
      addDiagnosticRow("本地 UDP", "up=" + snapshot.localUdpUploadPackets + ", down=" + snapshot.localUdpDownloadPackets);
    }
    if (!isEmpty(snapshot.tproxyStats)) addDiagnosticRow("tproxyStats", snapshot.tproxyStats);
    if (!isEmpty(snapshot.localStats)) addDiagnosticRow("localStats", snapshot.localStats);
    if (!isEmpty(snapshot.tunStats)) addDiagnosticRow("tunStats", snapshot.tunStats);
    if (!isEmpty(snapshot.localLastError)) addDiagnosticRow("localError", snapshot.localLastError);
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
    if (isHostControlView(snapshot) && "idle".equals(snapshot.mode)) return "等待电脑下发";
    if (isHostControlView(snapshot) && "normal".equals(snapshot.mode)) return "电脑下发已清除";
    if ("idle".equals(snapshot.mode)) return "本地待命";
    if ("normal".equals(snapshot.mode)) return "正常网络";
    if (snapshot.running) return formatPreset(snapshot);
    return "未开启弱网";
  }

  private String getStateDescription(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, snapshot.error, "弱网代理启动失败。");
    if ("needs_permission".equals(snapshot.mode)) return "请先完成一次系统 VPN 授权。";
    if ("unsupported".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "当前预设暂不支持 Android VPN Agent。");
    if (isHostControlView(snapshot)) {
      if ("socks".equals(snapshot.mode) && snapshot.running) return "由电脑控制台下发，APK 通过 VPN 接管目标应用并转发到电脑 SOCKS 出口。";
      if ("blackhole".equals(snapshot.mode) && snapshot.running) return "由电脑控制台下发，目标应用流量在手机 VPN 内直接丢弃。";
      if ("normal".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "电脑下发的 Android VPN 弱网已清除。");
      if ("idle".equals(snapshot.mode)) return "等待 Windows/Mac 控制台下发 Android VPN Agent 预设。";
    }
    if ("local".equals(snapshot.mode) && snapshot.running) return "在手机本地接管目标应用流量并执行弱网。";
    if ("socks".equals(snapshot.mode) && snapshot.running) return "通过 SOCKS 出口接管目标应用流量。";
    if ("blackhole".equals(snapshot.mode) && snapshot.running) return "目标应用流量已被直接丢弃。";
    if ("normal".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "手机端弱网已停止，目标应用恢复正常网络。");
    if ("idle".equals(snapshot.mode)) return firstNonEmpty(snapshot.message, "选择目标包名和弱网预设后，可直接在手机上应用。");
    return firstNonEmpty(snapshot.message, snapshot.running ? "弱网代理正在运行。" : "弱网代理未运行。");
  }

  private String getStateBadge(StatusSnapshot snapshot) {
    if (isHostControlView(snapshot) && !"error".equals(snapshot.mode) && !"needs_permission".equals(snapshot.mode)) return "电脑";
    if ("local".equals(snapshot.mode)) return "本地";
    if ("socks".equals(snapshot.mode)) return "SOCKS";
    if ("blackhole".equals(snapshot.mode)) return "断网";
    if ("needs_permission".equals(snapshot.mode)) return "授权";
    if ("error".equals(snapshot.mode)) return "错误";
    if ("normal".equals(snapshot.mode)) return "正常";
    if ("idle".equals(snapshot.mode)) return "待命";
    return firstNonEmpty(snapshot.mode, "未知");
  }

  private String getLinkText(StatusSnapshot snapshot) {
    if (isHostControlView(snapshot)) {
      if ("blackhole".equals(snapshot.mode)) return "电脑控制台 > Android VPN > 直接丢包";
      if ("socks".equals(snapshot.mode)) return "电脑控制台 > SOCKS 出口 > Android VPN";
      return "电脑控制台 > Android Agent";
    }
    if ("local".equals(snapshot.mode)) return "Android VPN > 本地弱网";
    if ("socks".equals(snapshot.mode)) return "Android VPN > SOCKS 出口 > 弱网规则";
    if ("blackhole".equals(snapshot.mode)) return "Android VPN > 直接丢包";
    if ("needs_permission".equals(snapshot.mode)) return "系统授权 > 手机本地控制";
    if ("error".equals(snapshot.mode)) return "Android Agent > 错误";
    return "手机本地控制 > Android Agent";
  }

  private String getNextStep(StatusSnapshot snapshot) {
    if (isHostControlView(snapshot)) {
      if ("needs_permission".equals(snapshot.mode)) return "下一步：点击“授权 VPN”，同意系统弹窗后回到电脑控制台重新点击“应用预设”。";
      if (snapshot.running) return "当前由电脑控制台下发。手机端可清除弱网；需要独立运行时，点击顶部小按钮切到本机控制。";
      if ("normal".equals(snapshot.mode)) return "当前电脑下发的弱网已清除。需要继续电脑控制时，在 Windows/Mac 控制台重新应用预设。";
      return "下一步：在 Windows/Mac 控制台选择 Android VPN Agent 模式并应用预设。";
    }
    if ("needs_permission".equals(snapshot.mode)) return "下一步：点击“授权 VPN”，同意系统弹窗后回到本页点击“应用本地弱网”。";
    if ("idle".equals(snapshot.mode)) {
      if (SCOPE_GLOBAL.equals(targetScope)) return "下一步：选择弱网预设，然后点击“应用本地弱网”。";
      return "下一步：输入并确认目标包名，选择弱网预设，然后点击“应用本地弱网”。";
    }
    if ("local".equals(snapshot.mode) && snapshot.running) return "当前 Android 本地弱网已生效。可直接切换预设重新应用，结束测试后点击“清除弱网”。";
    if ("socks".equals(snapshot.mode) && snapshot.running) return "当前是电脑下发的 SOCKS 模式。手机端可清除弱网；要脱离电脑运行，请在上方应用本地预设。";
    if ("blackhole".equals(snapshot.mode) && snapshot.running) return "当前为 100% 丢包，只会影响目标应用。结束测试后点击“清除弱网”。";
    if ("error".equals(snapshot.mode)) return "下一步：先刷新状态；若仍失败，请展开诊断详情查看错误和最近日志。";
    if ("normal".equals(snapshot.mode)) return "当前手机端弱网已停止。需要继续测试时，在本页重新应用本地预设。";
    return "可在本页应用或清除 Android 本地弱网。";
  }

  private String getTcpStatsText(StatusSnapshot snapshot) {
    if ("blackhole".equals(snapshot.mode)) {
      return snapshot.blackholePacketCount + " 包 / " + formatBytes(snapshot.blackholeByteCount);
    }
    if (hasLocalStats(snapshot)) {
      String value = "活动 " + snapshot.localTcpActive + " / 累计 " + snapshot.localTcpAccepted;
      if (snapshot.localTcpConnectFailed > 0) value += " / 失败 " + snapshot.localTcpConnectFailed;
      return value;
    }
    if (isHostControlView(snapshot) && "socks".equals(snapshot.mode) && snapshot.running) return "电脑端统计";
    if ("local".equals(snapshot.mode) && snapshot.running) return "等待目标应用流量";
    if ("socks".equals(snapshot.mode) && snapshot.running) return "查看诊断详情";
    return "暂无";
  }

  private String getTrafficStatsText(StatusSnapshot snapshot) {
    if ("blackhole".equals(snapshot.mode)) return "已丢弃 " + formatBytes(snapshot.blackholeByteCount);
    if (hasLocalStats(snapshot)) {
      return "上行 " + formatBytes(snapshot.localUploadBytes) + " / 下行 " + formatBytes(snapshot.localDownloadBytes);
    }
    if (isHostControlView(snapshot) && "socks".equals(snapshot.mode) && snapshot.running) return "电脑端曲线查看";
    if ("local".equals(snapshot.mode) && snapshot.running) return "等待目标应用流量";
    return "暂无";
  }

  private String getWeaknetHitText(StatusSnapshot snapshot) {
    if ("blackhole".equals(snapshot.mode)) return "丢弃 " + snapshot.blackholePacketCount + " 包";
    if (hasLocalStats(snapshot)) {
      long total = snapshot.localDroppedPackets + snapshot.localBlockedPackets + snapshot.localDelayedPackets;
      if (total == 0) return "暂无命中";
      return "丢弃 " + snapshot.localDroppedPackets + " / 阻断 " + snapshot.localBlockedPackets + " / 延迟 " + snapshot.localDelayedPackets;
    }
    if (isHostControlView(snapshot) && "socks".equals(snapshot.mode) && snapshot.running) return "由电脑端弱网规则命中";
    if ("local".equals(snapshot.mode) && snapshot.running) return "等待弱网命中";
    return "暂无";
  }

  private String getLiveStatusText(StatusSnapshot snapshot) {
    String age = formatRelativeAge(snapshot.updatedAt);
    if ("error".equals(snapshot.mode)) return "● 异常 · " + age;
    if ("needs_permission".equals(snapshot.mode)) return "● 待授权";
    if ("unsupported".equals(snapshot.mode)) return "● 不支持";
    if (snapshot.running) {
      if (hasAnyTrafficHit(snapshot)) return "● 实时命中 · " + age;
      return "● 实时监控 · " + age;
    }
    if ("normal".equals(snapshot.mode)) return "● 已恢复 · " + age;
    return "● 待命 · " + age;
  }

  private boolean hasAnyTrafficHit(StatusSnapshot snapshot) {
    return snapshot.blackholePacketCount > 0
      || snapshot.blackholeByteCount > 0
      || snapshot.localUploadBytes > 0
      || snapshot.localDownloadBytes > 0
      || snapshot.localDroppedPackets > 0
      || snapshot.localBlockedPackets > 0
      || snapshot.localDelayedPackets > 0
      || snapshot.localUdpUploadPackets > 0
      || snapshot.localUdpDownloadPackets > 0;
  }

  private String getSnapshotTargetText(StatusSnapshot snapshot) {
    if (snapshot == null) return "未指定";
    if (SCOPE_GLOBAL.equals(snapshot.targetScope)) return "整机流量";
    return firstNonEmpty(snapshot.targetPackage, "未指定");
  }

  private boolean hasLocalStats(StatusSnapshot snapshot) {
    return snapshot.localTcpAccepted > 0
      || snapshot.localTcpActive > 0
      || snapshot.localTcpConnectFailed > 0
      || snapshot.localUploadBytes > 0
      || snapshot.localDownloadBytes > 0
      || snapshot.localDroppedPackets > 0
      || snapshot.localBlockedPackets > 0
      || snapshot.localDelayedPackets > 0
      || snapshot.localUdpUploadPackets > 0
      || snapshot.localUdpDownloadPackets > 0;
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
    if (snapshot.running) return GREEN;
    return BLUE_LINE;
  }

  private int getStatusHeaderFill(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED_BG;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER_BG;
    if ("normal".equals(snapshot.mode)) return SURFACE_MUTED;
    if (snapshot.running) return GREEN_SOFT;
    return BLUE_BG;
  }

  private int getStatusHeaderStroke(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED_LINE;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER_LINE;
    if ("normal".equals(snapshot.mode)) return LINE;
    if (snapshot.running) return GREEN;
    return BLUE_LINE;
  }

  private int getStatusHeaderText(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER;
    return TEXT;
  }

  private int getStatusHeaderMuted(StatusSnapshot snapshot) {
    if ("error".equals(snapshot.mode)) return RED;
    if ("needs_permission".equals(snapshot.mode) || "unsupported".equals(snapshot.mode)) return AMBER;
    return MUTED;
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

  private String formatRelativeAge(long updatedAt) {
    if (updatedAt <= 0) return "未同步";
    long diffMs = Math.max(0L, System.currentTimeMillis() - updatedAt);
    if (diffMs < 1400L) return "实时";
    long seconds = Math.max(1L, diffMs / 1000L);
    if (seconds < 60L) return seconds + " 秒前";
    long minutes = seconds / 60L;
    if (minutes < 60L) return minutes + " 分钟前";
    return (minutes / 60L) + " 小时前";
  }

  private String formatBytes(long bytes) {
    if (bytes < 1024) return bytes + " B";
    double value = bytes;
    String[] units = new String[] { "B", "KB", "MB", "GB" };
    int unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return String.format(Locale.US, "%.1f %s", value, units[unit]);
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
    int disabled = MUTED;
    int pressed = primary ? PRIMARY_TEXT : GREEN_DARK;
    int normal = primary ? PRIMARY_TEXT : TEXT;
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
      buttonShape(primary, false, true)
    );
    states.addState(
      new int[] { android.R.attr.state_pressed },
      buttonShape(primary, true, false)
    );
    states.addState(
      new int[] {},
      buttonShape(primary, false, false)
    );

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      int ripple = primary ? Color.argb(64, 255, 255, 255) : Color.argb(32, 15, 123, 85);
      return new RippleDrawable(ColorStateList.valueOf(ripple), states, null);
    }
    return states;
  }

  private GradientDrawable buttonShape(boolean primary, boolean pressed, boolean disabled) {
    if (disabled) {
      if (primary) {
        return gradientRounded(
          new int[] { blendColor(LINE, GLASS_TOP, 0.22f), blendColor(LINE, GLASS_BOTTOM, 0.12f) },
          GradientDrawable.Orientation.TOP_BOTTOM,
          LINE,
          8
        );
      }
      return gradientRounded(
        new int[] { blendColor(GLASS_MUTED_TOP, LINE, 0.12f), blendColor(GLASS_MUTED_BOTTOM, LINE, 0.08f) },
        GradientDrawable.Orientation.TOP_BOTTOM,
        LINE,
        8
      );
    }
    if (primary) {
      return gradientRounded(
        new int[] {
          pressed ? PRIMARY_PRESSED_TOP : PRIMARY_TOP,
          pressed ? PRIMARY_PRESSED_BOTTOM : PRIMARY_BOTTOM
        },
        GradientDrawable.Orientation.TOP_BOTTOM,
        pressed ? PRIMARY_PRESSED_BOTTOM : PRIMARY_BOTTOM,
        8
      );
    }
    return gradientRounded(
      new int[] {
        pressed ? blendColor(GREEN_SOFT, GLASS_MUTED_TOP, 0.16f) : GLASS_MUTED_TOP,
        pressed ? blendColor(GREEN_SOFT, GLASS_MUTED_BOTTOM, 0.10f) : GLASS_MUTED_BOTTOM
      },
      GradientDrawable.Orientation.TOP_BOTTOM,
      pressed ? GREEN : LINE,
      8
    );
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

  private Drawable pageBackground() {
    return gradientRounded(
      new int[] { PAGE_TOP, PAGE_MID, PAGE_BOTTOM },
      GradientDrawable.Orientation.TOP_BOTTOM,
      PAGE_BOTTOM,
      0
    );
  }

  private Drawable glassControlCardBackground() {
    return gradientRounded(
      new int[] { GLASS_TOP, GLASS_BOTTOM },
      GradientDrawable.Orientation.TOP_BOTTOM,
      LINE,
      8
    );
  }

  private Drawable glassStatusCardBackground() {
    return gradientRounded(
      new int[] {
        blendColor(GLASS_TOP, BLUE_BG, isDarkTheme() ? 0.18f : 0.08f),
        blendColor(GLASS_BOTTOM, BLUE_BG, isDarkTheme() ? 0.10f : 0.05f)
      },
      GradientDrawable.Orientation.TOP_BOTTOM,
      blendColor(LINE, BLUE_LINE, 0.34f),
      8
    );
  }

  private Drawable glassDiagnosticsBackground() {
    return gradientRounded(
      new int[] {
        blendColor(GLASS_TOP, SURFACE_MUTED, isDarkTheme() ? 0.26f : 0.14f),
        blendColor(GLASS_BOTTOM, SURFACE_MUTED, isDarkTheme() ? 0.16f : 0.08f)
      },
      GradientDrawable.Orientation.TOP_BOTTOM,
      LINE,
      8
    );
  }

  private Drawable glassNoticeBackground() {
    return gradientRounded(
      new int[] {
        blendColor(AMBER_BG, GLASS_TOP, isDarkTheme() ? 0.24f : 0.36f),
        blendColor(AMBER_BG, GLASS_BOTTOM, isDarkTheme() ? 0.12f : 0.20f)
      },
      GradientDrawable.Orientation.LEFT_RIGHT,
      AMBER_LINE,
      8
    );
  }

  private Drawable glassInputBackground() {
    return gradientRounded(
      new int[] { GLASS_MUTED_TOP, GLASS_MUTED_BOTTOM },
      GradientDrawable.Orientation.TOP_BOTTOM,
      LINE,
      8
    );
  }

  private Drawable glassTintBackground(int fill, int stroke, int radiusDp) {
    return gradientRounded(
      new int[] {
        blendColor(fill, GLASS_TOP, isDarkTheme() ? 0.20f : 0.32f),
        blendColor(fill, GLASS_BOTTOM, isDarkTheme() ? 0.08f : 0.16f)
      },
      GradientDrawable.Orientation.TOP_BOTTOM,
      stroke,
      radiusDp
    );
  }

  private GradientDrawable gradientRounded(int[] colors, GradientDrawable.Orientation orientation, int stroke, int radiusDp) {
    GradientDrawable drawable = new GradientDrawable(orientation, colors);
    drawable.setCornerRadius(dp(radiusDp));
    drawable.setStroke(dp(1), stroke);
    return drawable;
  }

  private int blendColor(int from, int to, float ratio) {
    float clamped = Math.max(0f, Math.min(1f, ratio));
    int alpha = Math.round(Color.alpha(from) + (Color.alpha(to) - Color.alpha(from)) * clamped);
    int red = Math.round(Color.red(from) + (Color.red(to) - Color.red(from)) * clamped);
    int green = Math.round(Color.green(from) + (Color.green(to) - Color.green(from)) * clamped);
    int blue = Math.round(Color.blue(from) + (Color.blue(to) - Color.blue(from)) * clamped);
    return Color.argb(alpha, red, green, blue);
  }

  private boolean isDarkTheme() {
    return !THEME_CLASSIC.equals(currentThemeKey);
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

  private static boolean isValidPackageName(String value) {
    return value != null && PACKAGE_PATTERN.matcher(value).matches();
  }

  private boolean isTargetPackageInstalled(String packageName) {
    try {
      getPackageManager().getPackageInfo(packageName, 0);
      return true;
    } catch (PackageManager.NameNotFoundException ignored) {
      return false;
    }
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

  private static String normalizeTargetScopeStatic(String scope) {
    if (SCOPE_GLOBAL.equals(scope)) return SCOPE_GLOBAL;
    return SCOPE_SINGLE;
  }

  private static class Preset {
    final String presetKey;
    final String name;
    final String scene;
    final Integer latencyRttMs;
    final Integer jitterMs;
    final double packetLossPercent;
    final Double downloadKbps;
    final Double uploadKbps;
    final String disconnectMode;
    final int disconnectDurationSec;
    final int disconnectIntervalSec;
    final boolean networkWaveEnabled;

    Preset(
      String presetKey,
      String name,
      String scene,
      Integer latencyRttMs,
      Integer jitterMs,
      double packetLossPercent,
      Double downloadKbps,
      Double uploadKbps,
      String disconnectMode,
      int disconnectDurationSec,
      int disconnectIntervalSec
    ) {
      this(
        presetKey,
        name,
        scene,
        latencyRttMs,
        jitterMs,
        packetLossPercent,
        downloadKbps,
        uploadKbps,
        disconnectMode,
        disconnectDurationSec,
        disconnectIntervalSec,
        false
      );
    }

    Preset(
      String presetKey,
      String name,
      String scene,
      Integer latencyRttMs,
      Integer jitterMs,
      double packetLossPercent,
      Double downloadKbps,
      Double uploadKbps,
      String disconnectMode,
      int disconnectDurationSec,
      int disconnectIntervalSec,
      boolean networkWaveEnabled
    ) {
      this.presetKey = presetKey;
      this.name = name;
      this.scene = scene;
      this.latencyRttMs = latencyRttMs;
      this.jitterMs = jitterMs;
      this.packetLossPercent = packetLossPercent;
      this.downloadKbps = downloadKbps;
      this.uploadKbps = uploadKbps;
      this.disconnectMode = disconnectMode;
      this.disconnectDurationSec = disconnectDurationSec;
      this.disconnectIntervalSec = disconnectIntervalSec;
      this.networkWaveEnabled = networkWaveEnabled;
    }
  }

  private static class AppCandidate {
    final String packageName;
    long lastUsedAt;
    boolean running;

    AppCandidate(String packageName, long lastUsedAt, boolean running) {
      this.packageName = packageName;
      this.lastUsedAt = lastUsedAt;
      this.running = running;
    }
  }

  private static class StatusSnapshot {
    boolean permissionGranted;
    boolean running;
    String mode = "";
    String dataplane = "";
    String presetKey = "";
    String displayName = "";
    String targetScope = SCOPE_SINGLE;
    String targetPackage = "";
    String message = "";
    String error = "";
    String socksHost = "";
    int socksPort;
    long blackholePacketCount;
    long blackholeByteCount;
    long blackholeLastHitAt;
    String tproxyStats = "";
    String tproxyLogTail = "";
    String localStats = "";
    String tunStats = "";
    long localTcpAccepted;
    long localTcpActive;
    long localTcpConnectFailed;
    long localUdpUploadPackets;
    long localUdpDownloadPackets;
    long localUploadBytes;
    long localDownloadBytes;
    long localDroppedPackets;
    long localBlockedPackets;
    long localDelayedPackets;
    String localLastError = "";
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
        snapshot.dataplane = optString(status, "dataplane");
        snapshot.presetKey = optString(status, "presetKey");
        snapshot.displayName = firstNonEmpty(optString(status, "displayName"), optString(status, "displayNameZh"));
        snapshot.targetScope = normalizeTargetScopeStatic(optString(status, "targetScope"));
        snapshot.targetPackage = optString(status, "targetPackage");
        snapshot.message = optString(status, "message");
        snapshot.error = optString(status, "error");
        snapshot.socksHost = optString(status, "socksHost");
        snapshot.socksPort = status.optInt("socksPort", 0);
        snapshot.blackholePacketCount = status.optLong("blackholePacketCount", 0L);
        snapshot.blackholeByteCount = status.optLong("blackholeByteCount", 0L);
        snapshot.blackholeLastHitAt = status.optLong("blackholeLastHitAt", 0L);
        Object stats = status.opt("tproxyStats");
        snapshot.tproxyStats = stats == null ? "" : String.valueOf(stats);
        Object localStats = status.opt("localStats");
        snapshot.localStats = localStats == null ? "" : String.valueOf(localStats);
        parseLocalStats(snapshot, localStats);
        Object tunStats = status.opt("tunStats");
        snapshot.tunStats = tunStats == null ? "" : String.valueOf(tunStats);
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

    private static void parseLocalStats(StatusSnapshot snapshot, Object raw) {
      JSONObject stats = null;
      try {
        if (raw instanceof JSONObject) {
          stats = (JSONObject) raw;
        } else if (raw != null) {
          String value = String.valueOf(raw);
          if (!isEmpty(value) && value.startsWith("{")) stats = new JSONObject(value);
        }
        if (stats == null) return;
        snapshot.localTcpAccepted = stats.optLong("tcpAccepted", 0L);
        snapshot.localTcpActive = stats.optLong("tcpActive", 0L);
        snapshot.localTcpConnectFailed = stats.optLong("tcpConnectFailed", 0L);
        snapshot.localUdpUploadPackets = stats.optLong("udpUploadPackets", 0L);
        snapshot.localUdpDownloadPackets = stats.optLong("udpDownloadPackets", 0L);
        snapshot.localUploadBytes = stats.optLong("uploadBytes", 0L);
        snapshot.localDownloadBytes = stats.optLong("downloadBytes", 0L);
        snapshot.localDroppedPackets = stats.optLong("droppedPackets", 0L);
        snapshot.localBlockedPackets = stats.optLong("blockedPackets", 0L);
        snapshot.localDelayedPackets = stats.optLong("delayedPackets", 0L);
        snapshot.localLastError = optString(stats, "lastError");
      } catch (Exception ignored) {
      }
    }
  }
}
