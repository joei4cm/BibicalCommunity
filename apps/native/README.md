# LogosHome native shells (Android / iOS)

Capacitor wrapper around `apps/web/dist`.

```bash
pnpm --filter @logoshome/web build
cd apps/native
npm install
npm run sync:web
npx cap add android   # once
npx cap add ios       # once, on macOS
npm run patch:android # WebView: no pinch-zoom / overscroll rubber-band
npm run build:android # sync + patch + debug APK
```

CI (`.github/workflows/package.yml`) generates Android debug APK and an iOS simulator archive on every `main` push / tag. After `cap add` / `cap sync`, it runs `npm run patch:android` so the APK locks zoom and overscroll.
