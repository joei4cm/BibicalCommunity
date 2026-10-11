import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDist = path.resolve(root, "../web/dist");
const www = path.join(root, "www");

if (!existsSync(webDist) || !existsSync(path.join(webDist, "index.html"))) {
  console.error(`Missing web build at ${webDist}. Run: pnpm --filter @logoshome/web build`);
  process.exit(1);
}

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
cpSync(webDist, www, { recursive: true });
writeFileSync(
  path.join(www, ".capacitor-stamp"),
  `synced ${new Date().toISOString()}\n`,
);
console.log(`Synced ${webDist} → ${www}`);
