# LogosHome native shells (Android / iOS)

Capacitor wrapper around `apps/web/dist`.

```bash
pnpm --filter @logoshome/web build
cd apps/native
npm install
npm run sync:web
npx cap add android   # once
npx cap add ios       # once, on macOS
npm run build:android # debug APK via Gradle
```

CI (`.github/workflows/package.yml`) generates Android debug APK and an iOS simulator archive on every `main` push / tag.
