/** Client-side device label for login/register (platform + short UA hint). */

export type DevicePlatform = "web" | "ios" | "android" | "desktop" | "unknown";

export function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Electron/i.test(ua)) return "desktop";
  return "web";
}

/** Short human label, e.g. "Chrome · macOS", "Safari · iPhone". */
export function buildDeviceName(platform: DevicePlatform = detectDevicePlatform()): string {
  if (typeof navigator === "undefined") return platformLabel(platform);
  const ua = navigator.userAgent || "";
  const browser =
    /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua) && !/Edg\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua) && !/Chrome\//.test(ua)
            ? "Safari"
            : /Electron/i.test(ua)
              ? "Desktop"
              : null;
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua)
      ? "macOS"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/i.test(ua)
          ? /iPad/i.test(ua)
            ? "iPad"
            : "iPhone"
          : /Linux/i.test(ua)
            ? "Linux"
            : null;

  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return `${platformLabel(platform)} · ${os}`;
  return platformLabel(platform);
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case "web":
      return "Web";
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "desktop":
      return "Desktop";
    default:
      return platform || "Device";
  }
}
