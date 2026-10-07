type MediaKind = "youtube" | "vimeo" | "audio" | "video" | "link";

const AUDIO_EXT = /\.(mp3|m4a|ogg|wav|aac)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogv)(\?|$)/i;

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    return id ?? null;
  } catch {
    return null;
  }
}

export function classifyMediaUrl(url: string): { kind: MediaKind; embedSrc?: string } {
  const yt = youtubeId(url);
  if (yt) return { kind: "youtube", embedSrc: `https://www.youtube-nocookie.com/embed/${yt}` };
  const vm = vimeoId(url);
  if (vm) return { kind: "vimeo", embedSrc: `https://player.vimeo.com/video/${vm}` };
  if (AUDIO_EXT.test(url)) return { kind: "audio" };
  if (VIDEO_EXT.test(url)) return { kind: "video" };
  return { kind: "link" };
}

export function ExternalMedia({ url }: { url: string }) {
  const media = classifyMediaUrl(url);
  if (media.kind === "youtube" || media.kind === "vimeo") {
    return (
      <div className="media-embed">
        <iframe
          src={media.embedSrc}
          title={media.kind}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (media.kind === "audio") {
    return (
      <audio className="media-native" controls preload="metadata" src={url}>
        <track kind="captions" />
      </audio>
    );
  }
  if (media.kind === "video") {
    return (
      <video className="media-native" controls preload="metadata" src={url}>
        <track kind="captions" />
      </video>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {url}
    </a>
  );
}
