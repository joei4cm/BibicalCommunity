#!/usr/bin/env node
/**
 * Rasterize apps/web/public/icon.svg → PNG set used by PWA / apple-touch.
 * Requires sharp when regenerating:
 *   pnpm add -D sharp && node scripts/generate-app-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("Install sharp first: pnpm add -D sharp");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "apps/web/public/icon.svg");
const outDir = join(root, "apps/web/public/icons");
mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

async function writePng(name, size, { maskable = false } = {}) {
  let pipeline = sharp(svg, { density: 384 }).resize(size, size);
  if (maskable) {
    // Safe-zone padding for adaptive icons (~10% inset already in art; add soft pad).
    const pad = Math.round(size * 0.08);
    pipeline = sharp(svg, { density: 384 })
      .resize(size - pad * 2, size - pad * 2)
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 28, g: 61, b: 72, alpha: 1 },
      });
  }
  const buf = await pipeline.png().toBuffer();
  writeFileSync(join(outDir, name), buf);
  console.log(`OK ${name} (${size}px)`);
}

await writePng("icon-192.png", 192);
await writePng("icon-512.png", 512);
await writePng("icon-maskable-512.png", 512, { maskable: true });

// Mirror into Capacitor www if present (build will overwrite from web dist).
console.log("APP_ICONS_OK");
