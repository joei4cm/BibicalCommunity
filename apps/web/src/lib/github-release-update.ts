/**
 * Capacitor / packaged Android shell: check GitHub Releases for a newer APK.
 * Web/PWA keeps using service-worker updates (`pwa-update.ts`).
 */
import { APP_VERSION } from "./app-version";

function resolveGithubRepo(): string {
  try {
    const fromEnv = String(import.meta.env.VITE_GITHUB_REPO ?? "").trim();
    if (fromEnv) return fromEnv;
  } catch {
    /* non-vite */
  }
  return "joei4cm/BibicalCommunity";
}

const CHECK_KEY = "lh.apkUpdate.lastCheck";
const DISMISS_KEY = "lh.apkUpdate.dismissedTag";
/** Minimum interval between automatic checks (ms). */
const AUTO_CHECK_MS = 12 * 60 * 60 * 1000;

export type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
  content_type?: string;
};

export type GithubRelease = {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  assets: GithubReleaseAsset[];
};

export type ApkUpdateInfo = {
  tag: string;
  version: string;
  releaseUrl: string;
  apkUrl: string;
  apkName: string;
  currentVersion: string;
};

export function isCapacitorAndroid(): boolean {
  try {
    const w = window as Window & { Capacitor?: { getPlatform?: () => string } };
    return w.Capacitor?.getPlatform?.() === "android";
  } catch {
    return false;
  }
}

/** True for Capacitor / Electron packaged shells (not browser PWA). */
export function isPackagedNativeShell(): boolean {
  try {
    const w = window as Window & { Capacitor?: unknown; electronAPI?: unknown };
    const proto = window.location.protocol;
    return (
      proto === "capacitor:" ||
      proto === "ionic:" ||
      proto === "file:" ||
      Boolean(w.Capacitor) ||
      Boolean(w.electronAPI)
    );
  } catch {
    return false;
  }
}

export function parseSemverParts(v: string): [number, number, number] {
  const clean = v.trim().replace(/^v/i, "").split("+")[0]!.split("-")[0]!;
  const parts = clean.split(".").map((n) => {
    const x = Number.parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Remote is newer than local (ignores build metadata / prerelease suffix). */
export function isRemoteNewer(remoteTagOrVersion: string, localVersion: string): boolean {
  const a = parseSemverParts(remoteTagOrVersion);
  const b = parseSemverParts(localVersion);
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return false;
}

export function pickAndroidApkAsset(assets: GithubReleaseAsset[]): GithubReleaseAsset | null {
  const apk = assets.filter((a) => /\.apk$/i.test(a.name));
  if (apk.length === 0) return null;
  const preferred =
    apk.find((a) => /android/i.test(a.name) && /LogosHome/i.test(a.name)) ??
    apk.find((a) => /android/i.test(a.name)) ??
    apk[0];
  return preferred ?? null;
}

export async function fetchLatestGithubRelease(
  repo = resolveGithubRepo(),
): Promise<GithubRelease> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`github_release_http_${res.status}`);
  }
  const json = (await res.json()) as GithubRelease;
  if (!json?.tag_name) throw new Error("github_release_invalid");
  return json;
}

export async function checkApkUpdateFromGithub(opts?: {
  repo?: string;
  currentVersion?: string;
}): Promise<ApkUpdateInfo | null> {
  const current = opts?.currentVersion ?? APP_VERSION;
  const release = await fetchLatestGithubRelease(opts?.repo ?? resolveGithubRepo());
  if (!isRemoteNewer(release.tag_name, current)) return null;
  const asset = pickAndroidApkAsset(release.assets ?? []);
  if (!asset) return null;
  return {
    tag: release.tag_name,
    version: release.tag_name.replace(/^v/i, ""),
    releaseUrl: release.html_url,
    apkUrl: asset.browser_download_url,
    apkName: asset.name,
    currentVersion: current,
  };
}

export function shouldAutoCheckApkUpdate(now = Date.now()): boolean {
  if (!isCapacitorAndroid()) return false;
  try {
    const raw = localStorage.getItem(CHECK_KEY);
    const last = raw ? Number(raw) : 0;
    if (!Number.isFinite(last) || last <= 0) return true;
    return now - last >= AUTO_CHECK_MS;
  } catch {
    return true;
  }
}

export function markApkUpdateChecked(now = Date.now()): void {
  try {
    localStorage.setItem(CHECK_KEY, String(now));
  } catch {
    /* ignore */
  }
}

export function isApkUpdateDismissed(tag: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === tag;
  } catch {
    return false;
  }
}

export function dismissApkUpdate(tag: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, tag);
  } catch {
    /* ignore */
  }
}

/** Open APK download / release page (Android WebView hands off to system). */
export function openApkDownload(info: ApkUpdateInfo): void {
  const url = info.apkUrl || info.releaseUrl;
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
}
