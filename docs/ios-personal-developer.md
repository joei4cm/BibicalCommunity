# iOS — overseas personal Apple Developer path

Prepare **individual** Apple Developer Program enrollment (any supported region outside
Mainland China entity requirements is fine) → **TestFlight** → later **App Store**.

LogosHome currently ships two mobile tracks:

| Track | Path | What Release CI produces today |
| --- | --- | --- |
| **Capacitor shell** (primary APK / sim) | `apps/native` | Android debug APK + **iOS Simulator** zip only |
| **Expo / EAS** (store-oriented) | `apps/mobile` | Optional EAS preview when `EXPO_TOKEN` is set |

True-phone installs need a **device-signed IPA**, not the simulator zip.

---

## 0. Decide the shipping shell (do this first)

**Recommendation for first TestFlight:** keep **Capacitor** (`apps/native`) as the
binary users install — it already wraps production `apps/web` the same way Android
APK does. Use Expo (`apps/mobile`) only if you intentionally want a separate native
UI; otherwise avoid maintaining two store listings.

Bundle IDs today:

- Capacitor: `app.logoshome.shell` (`apps/native/capacitor.config.json`)
- Expo: `app.logoshome.mobile` (`apps/mobile/app.json`)

Pick **one** App Store Connect app / bundle id and stick to it.

---

## 1. Account checklist (personal developer, overseas)

1. Create / use an **Apple ID** registered in the region you want for tax/banking
   (e.g. Hong Kong, US, Singapore — individual is allowed).
2. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) —
   **Individual**, USD 99 / year. Approval is usually hours–a few days.
3. In App Store Connect → **Agreements, Tax, and Banking**: accept Paid Apps (even if
   free), complete tax forms for that region, add a bank account that Apple accepts
   for that entity.
4. Create the App record: name, primary language, bundle id matching the chosen shell,
   SKU, user access (yourself).

No company / D-U-N-S is required for Individual.

---

## 2. Local Mac one-time setup (Capacitor → TestFlight)

Needs a Mac with Xcode (current stable).

```bash
pnpm --filter @logoshome/web build
cd apps/native
npm install
npm run sync:web
npx cap add ios          # once
npx cap sync ios
npx cap open ios         # opens Xcode
```

In Xcode:

1. Signing & Capabilities → Team = your personal team.
2. Bundle Identifier = `app.logoshome.shell` (or the id you registered).
3. Destination: **Any iOS Device (arm64)** — not Simulator.
4. Product → Archive → Distribute App → **App Store Connect** → Upload.
5. App Store Connect → TestFlight → add yourself (Internal) or external testers
   after the first build clears Apple’s automated processing.

**Ad Hoc / Development** (no TestFlight): register device UDIDs, export Ad Hoc IPA,
install via Apple Configurator / Xcode. Fine for 1–few phones; TestFlight scales better.

---

## 3. EAS path (Expo app, optional)

Profiles live in `apps/mobile/eas.json`:

| Profile | Purpose |
| --- | --- |
| `development` | Dev client, internal |
| `preview` | Internal distribution (Android APK; iOS device when credentials exist) |
| `testflight` | iOS App Store / TestFlight upload candidate |
| `production` | Store submission (AAB + iOS) |

### GitHub / Expo secrets to add when ready

| Secret | Where | Purpose |
| --- | --- | --- |
| `EXPO_TOKEN` | GitHub Actions | Enables `mobile-eas` job in Package workflow |
| Apple credentials | Expo / EAS | Via `eas credentials` (not committed) — Apple ID + app-specific password or Asc API key |

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure   # if projectId still placeholder
npx eas build --platform ios --profile testflight
npx eas submit --platform ios --profile production --latest
```

Until `extra.eas.projectId` is a real Expo project UUID and Apple credentials are
linked, CI’s EAS iOS step will no-op or fail soft (`continue-on-error`).

Align `apps/mobile` `version` with the monorepo release (currently Capacitor track
follows root `0.1.x`).

---

## 4. App Store Connect content (prepare offline)

Draft before first submit (zh-Hans primary is fine; add en for overseas listing):

- Subtitle, description, keywords, support URL, privacy policy URL
- Screenshots: 6.7" + 6.1" (and iPad if `supportsTablet`)
- Age rating questionnaire
- Privacy nutrition labels: account, messages (E2EE), contacts graph — be accurate
- App Review notes: test account + how church join / chat works
- Export compliance: HTTPS + our crypto — usually “uses encryption” with standard
  exemptions; confirm with counsel if marketing “military-grade”

---

## 5. Definition of done for this prep track

- [ ] Individual Apple Developer membership active
- [ ] Bundle id reserved in App Store Connect
- [ ] Tax / banking complete for that Apple ID region
- [ ] First **device** archive uploaded (Capacitor or EAS `testflight`)
- [ ] Internal TestFlight install on a physical iPhone
- [ ] (Later) Public TestFlight or App Store review submission

CI will keep publishing the **simulator** zip on tags for engineers; it does **not**
replace TestFlight.

---

## 6. What we deliberately do not automate yet

- Committing Apple certificates / provisioning profiles
- Paying the \$99 fee or creating the Apple ID (human)
- App Review submission without a human checklist pass
- Dual-listing both Capacitor and Expo under different bundle ids
