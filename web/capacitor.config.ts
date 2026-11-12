import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the web app in a native shell. The web app is the source of
 * truth: the records, the map and the bundle all live in here, and the native
 * side only provides the phone itself (the GPS, the camera, the file picker).
 */
const config: CapacitorConfig = {
  appId: "com.ainzkowfi.fibermap",
  appName: "fiberMAP",
  webDir: "dist",
  android: {
    // The app is served from its own assets, so it is offline by default.
    // An https scheme makes the WebView a secure context, which is what the
    // GPS and the camera need.
    allowMixedContent: false,
  },
};

export default config;
