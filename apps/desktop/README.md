# LogosHome desktop (Electron)

Thin Electron wrapper around `apps/web/dist`.

```bash
pnpm --filter @logoshome/web build
cd apps/desktop && npm install
npm run dist:linux   # AppImage + deb
npm run dist:mac     # DMG + zip (macOS host; unsigned OK in CI)
npm run dist:win     # NSIS + portable exe (Windows host)
```

CI (`.github/workflows/package.yml`) builds Linux, Windows, and macOS artifacts on every `main` push and attaches them to GitHub Releases on `v*` tags.
