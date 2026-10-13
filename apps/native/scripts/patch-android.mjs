/**
 * Capacitor regenerates `android/` in CI (`cap add android`).
 * Re-apply shell hardening after add/sync so APKs behave like a native app:
 * - no pinch/zoom chrome
 * - no overscroll rubber-band voids
 * - fixed text zoom (system font scale won't blow the layout)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainActivity = path.join(
  root,
  "android/app/src/main/java/app/logoshome/shell/MainActivity.java",
);

const MAIN_ACTIVITY = `package app.logoshome.shell;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hardenWebView();
    }

    private void hardenWebView() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
    }
}
`;

if (!existsSync(mainActivity)) {
  console.warn(`skip patch-android: missing ${mainActivity}`);
  process.exit(0);
}

const prev = readFileSync(mainActivity, "utf8");
if (prev.includes("hardenWebView")) {
  console.log("patch-android: MainActivity already hardened");
} else {
  writeFileSync(mainActivity, MAIN_ACTIVITY);
  console.log(`patch-android: wrote ${mainActivity}`);
}
