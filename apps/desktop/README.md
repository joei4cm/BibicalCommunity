# LogosHome desktop shell

Thin Electron wrapper around `apps/web/dist`.

```bash
pnpm --filter @logoshome/web build
cd apps/desktop && npm install
npm run dist:linux   # AppImage + deb
npm run dist:mac     # DMG (macOS host)
```

CI (`.github/workflows/package.yml`) builds Linux packages on every `main` push and attaches DMG/AppImage/deb to GitHub Releases when a `v*` tag is pushed.

Mobile APK/IPA builds run via Expo EAS when the `EXPO_TOKEN` repository secret is set.
