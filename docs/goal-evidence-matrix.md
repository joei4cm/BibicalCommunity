# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web` VitePWA; `PWA_BUILD_OK` (`manifest.webmanifest`+`sw.js`); Expo app + crypto gate | PARTIAL — PWA build PASS; physical device WebCrypto E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | Web+mobile annotate/delete/decrypt + multi-color swatches; A±/serif/LH + Compact/Comfortable/Spacious presets; first-party reader skins (parchment/paper/ink); `ANNOTATIONS_SMOKE_OK` / `READER_SKINS_OK` | PARTIAL — core+colors+typography+first-party skins PASS; licensed publisher theme packs OPEN |
| 3 | Translations zh/en/ja mainstream | 22-id registry; scaffolds through Phil.4/1Cor.13 + John.15/Rev.21; `MULTI_BOOK_*` + **`CORPUS_SCAFFOLD_INVENTORY_OK`** | PARTIAL — catalog + local scaffold inventory PASS; full licensed corpora OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` | PASS |
| 5 | Endao / WeRead by cross-login | `SSO_LOOP_OK` / `WEREAD_SSO_LOOP_OK`; **`PARTNER_TOKEN_EXCHANGE_OK`** via local `mock-token` | PARTIAL — local exchange E2E PASS; live partner IdP OPEN |
| 6 | Plans & devotion | `PLAN_CREATE_OK` + **`PLAN_CSV_SUBSCRIBE_OK`** + **`PLAN_DEVOTION_STEP_OK`** + **`DEVOTION_MATERIALS_OK`** (≥5 CC0 packs); advance-day; devotion binds plan day ref + material; step+material persisted | PARTIAL — client binding + persisted step + open devotion packs PASS; licensed third-party devotion packs OPEN |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK`; `HOME_MEMBERS_OK`; **`HOME_JOIN_SLUG_OK`** join-by-slug | PARTIAL — compose+roster+join PASS |
| 8 | E2EE chat TTL / archive | `KEYS_X3DH_CHAT_OK`; `KEYS_LIBSIGNAL_SEAM_OK`; `CURVE25519_X25519_OK` / `KEYS_CURVE25519_OK` (WebCrypto X25519+Ed25519); `TTL_TOMBSTONE_OK`; `ARCHIVE_OK`/`UNARCHIVE_OK`; mobile TTL+archive | PARTIAL — P-256+X25519+TTL+archive PASS; production `@signalapp/libsignal-client` OPEN |
| 9 | WebRTC + screen share | `CALL_SCREEN_SIGNAL_OK`; `SCREEN_SHARE_GATE_OK` (secure-context + getDisplayMedia probe) | PARTIAL — signaling+capability gate PASS; live OS picker still user-gesture / device OPEN |
| 10 | Me profile / privacy / search / verify / wipe | `ME_SMOKE_OK`; `HOME_VERIFY_OK` / `HOME_MEMBERS_OK` / `HOME_JOIN_SLUG_OK` / `HOME_WIPE_OK`; roster verify + join-by-slug | PARTIAL — verify+join UX PASS |
| 11 | Encrypted storage | `STORAGE_SMOKE_OK`; mobile `secure-kv` (expo-secure-store → AsyncStorage fallback) for note/session/device keys | PARTIAL — roundtrip+SecureStore path PASS; physical device E2E OPEN |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS |
| 13 | i18n + themes | `I18N_KEYS_OK` + `I18N_PARITY_OK` + `I18N_AUDIT_OK` + `I18N_NATIVE_COPY_OK` + `PWA_THEME_OK` + `READER_SKINS_OK` | PARTIAL — key parity + native differ-check PASS; human native QA OPEN |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK` (incl. migration `0004_devotion_step`); `DEPLOY_DRY_RUN_OK` | PARTIAL — preflight+dry-run PASS; live account OPEN |
| 15 | Hostile privacy floors / wipe | `HOME_HOSTILE_OK` + wipeToken; `SECURITY_AUDIT_OK` | PARTIAL |

## Smoke tokens

```bash
bash scripts/smoke-api.sh            # SMOKE_OK, PLAN_CSV_SUBSCRIBE_OK, ME_SMOKE_OK, MULTI_BOOK_*, SSO_*, …
bash scripts/smoke-me.sh             # ME_PROFILE_OK / ME_SEARCH_OK / ME_PRIVACY_HIDE_OK
bash scripts/smoke-storage.sh        # STORAGE_SMOKE_OK (session-aes / note / field / annotation)
bash scripts/smoke-home.sh           # HOME_JOIN_SLUG_OK / HOME_MEMBERS_OK / …
bash scripts/smoke-i18n-audit.sh     # I18N_AUDIT_OK
bash scripts/smoke-partners-oauth.sh # PARTNER_TOKEN_EXCHANGE_OK (local mock-token)
bash scripts/evidence-client-gates.sh # CRYPTO/SECURITY/I18N_PARITY/PWA_BUILD_OK → CLIENT_GATES_OK
bash scripts/smoke-corpus-inventory.sh # CORPUS_SCAFFOLD_INVENTORY_OK / DEVOTION_MATERIALS_OK
bash scripts/smoke-curve25519.sh       # CURVE25519_X25519_OK
RUN_DEPLOY_DRY_RUN=1 bash scripts/deploy-check.sh
```

## Explicitly not claimed

- Full licensed Bible corpora in R2
- Production `@signalapp/libsignal-client` (X25519 WebCrypto path is evidenced; not full Signal Protocol)
- Live Endao/WeRead IdP (local mock-token only)
- Browser `getDisplayMedia` picker without user gesture / insecure context
- Live Cloudflare account deploy with real resource IDs
- Licensed publisher Bible theme packs
