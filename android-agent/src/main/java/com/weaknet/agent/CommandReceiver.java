package com.weaknet.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class CommandReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    Intent serviceIntent = new Intent(context, WeaknetVpnService.class);
    serviceIntent.setAction(intent == null ? "" : intent.getAction());
    if (intent != null && intent.getExtras() != null) {
      serviceIntent.putExtras(intent.getExtras());
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent);
    } else {
      context.startService(serviceIntent);
    }
  }
}
