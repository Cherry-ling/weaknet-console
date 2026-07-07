package com.weaknet.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class CommandReceiver extends BroadcastReceiver {
  public static final String ACTION_CONFIGURE = "com.weaknet.agent.CONFIGURE";
  private static final String PREFS_NAME = "weaknet_agent";
  private static final String PREF_LEGACY_TARGET_PACKAGES = "target_packages";
  private static final String PREF_THEME = "theme";
  private static final String THEME_TERMINAL_AURORA = "terminal-aurora";
  private static final String THEME_CYBER = "cyber";
  private static final String THEME_CLASSIC = "classic";

  @Override
  public void onReceive(Context context, Intent intent) {
    saveTheme(context, intent);
    String action = intent == null ? "" : intent.getAction();
    if (ACTION_CONFIGURE.equals(action)) return;

    Intent serviceIntent = new Intent(context, WeaknetVpnService.class);
    serviceIntent.setAction(action);
    if (intent != null && intent.getExtras() != null) {
      serviceIntent.putExtras(intent.getExtras());
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent);
    } else {
      context.startService(serviceIntent);
    }
  }

  private void saveTheme(Context context, Intent intent) {
    if (context == null || intent == null) return;
    String theme = normalizeTheme(intent.getStringExtra(PREF_THEME));
    if (theme.isEmpty()) return;
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(PREF_LEGACY_TARGET_PACKAGES)
      .putString(PREF_THEME, theme)
      .apply();
  }

  private String normalizeTheme(String theme) {
    if (THEME_CYBER.equals(theme)) return THEME_CYBER;
    if (THEME_CLASSIC.equals(theme)) return THEME_CLASSIC;
    if (THEME_TERMINAL_AURORA.equals(theme)) return THEME_TERMINAL_AURORA;
    return "";
  }
}
