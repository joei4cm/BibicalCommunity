/** Bible GETs that are public-domain / catalog — no Authorization needed. */
export function isPublicBibleGetPath(path: string, method = "GET"): boolean {
  const m = (method || "GET").toUpperCase();
  if (m !== "GET" && m !== "HEAD") return false;
  const pathname = path.split("?")[0] ?? path;
  return (
    pathname === "/v1/bible/chapter" ||
    pathname === "/v1/bible/translations" ||
    pathname === "/v1/bible/corpus-catalog" ||
    pathname === "/v1/bible/corpus-packs" ||
    pathname.startsWith("/v1/bible/corpus-download/") ||
    pathname.startsWith("/v1/bible/corpus-revision/") ||
    pathname.startsWith("/v1/bible/audio/")
  );
}
