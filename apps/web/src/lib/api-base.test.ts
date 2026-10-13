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
