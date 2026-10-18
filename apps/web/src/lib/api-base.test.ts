import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Documents packaged-shell API base resolution without jsdom:
 * empty build-time base + packaged shell → production Worker default.
 */
function resolveApiBase(opts: {
  stored?: string | null;
  envBase?: string;
  packaged: boolean;
  defaultProd: string;
}): string {
  const stored = (opts.stored ?? "").trim().replace(/\/$/, "");
  if (stored) return stored;
  const env = (opts.envBase ?? "").trim().replace(/\/$/, "");
  if (env) return env;
  if (opts.packaged) return opts.defaultProd;
  return "";
}

function resolveApiUrl(base: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const b = base.trim().replace(/\/$/, "");
  return b ? `${b}${path}` : path;
}

describe("api url join", () => {
  it("keeps absolute urls", () => {
    assert.equal(
      resolveApiUrl("https://api.example", "https://cdn.example/a"),
      "https://cdn.example/a",
    );
  });

  it("prefixes relative media paths with the API base", () => {
    assert.equal(
      resolveApiUrl("https://logoshome-api.joei4cm.workers.dev", "/v1/media/put/media/u/1"),
      "https://logoshome-api.joei4cm.workers.dev/v1/media/put/media/u/1",
    );
  });

  it("stays same-origin when base is empty", () => {
    assert.equal(resolveApiUrl("", "/v1/media/x"), "/v1/media/x");
  });
});

describe("api base resolution", () => {
  const prod = "https://logoshome-api.joei4cm.workers.dev";

  it("uses stored override first", () => {
    assert.equal(
      resolveApiBase({
        stored: "https://custom.example.com/",
        envBase: prod,
        packaged: true,
        defaultProd: prod,
      }),
      "https://custom.example.com",
    );
  });

  it("uses env base for Pages / CI web builds", () => {
    assert.equal(
      resolveApiBase({ envBase: prod, packaged: false, defaultProd: prod }),
      prod,
    );
  });

  it("defaults packaged shells to production Worker when env empty", () => {
    assert.equal(
      resolveApiBase({ envBase: "", packaged: true, defaultProd: prod }),
      prod,
    );
  });

  it("keeps relative same-origin for browser/PWA without env", () => {
    assert.equal(
      resolveApiBase({ envBase: "", packaged: false, defaultProd: prod }),
      "",
    );
  });
});
