# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web` VitePWA; `PWA_BUILD_OK` (`manifest.webmanifest`+`sw.js`); Expo app + crypto gate | PARTIAL — PWA build PASS; physical device WebCrypto E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | Web+mobile annotate/delete/decrypt + multi-color swatches; A±/serif/LH + Compact/Comfortable/Spacious presets; `ANNOTATIONS_SMOKE_OK` | PARTIAL — core+colors+typography presets PASS; licensed theme skins OPEN |
| 3 | Translations zh/en/ja mainstream | 22-id registry; John + Gen/Matt/Ps + Rom.8/Heb.11 + Isa.53/Acts.2 + Ps.1/Prov.3 + Mark.1/Exod.20 + Luke.2/Deut.6 + Matt.6/Gal.5 + Phil.4/1Cor.13; `MULTI_BOOK_*` incl. `MULTI_BOOK_PASTORAL_OK` | PARTIAL — catalog + scaffolds; full licensed corpora OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` | PASS |
| 5 | Endao / WeRead by cross-login | `SSO_LOOP_OK` / `WEREAD_SSO_LOOP_OK`; **`PARTNER_TOKEN_EXCHANGE_OK`** via local `mock-token` | PARTIAL — local exchange E2E PASS; live partner IdP OPEN |
| 6 | Plans & devotion | `PLAN_CREATE_OK` + **`PLAN_CSV_SUBSCRIBE_OK`** + **`PLAN_DEVOTION_STEP_OK`**; advance-day; devotion binds plan day ref + material; step+material persisted on subscription | PARTIAL — client binding + persisted step PASS; licensed devotion packs OPEN |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK`; `HOME_MEMBERS_OK`; **`HOME_JOIN_SLUG_OK`** join-by-slug | PARTIAL — compose+roster+join PASS |
| 8 | E2EE chat TTL / archive | `KEYS_X3DH_CHAT_OK`; `KEYS_LIBSIGNAL_SEAM_OK`; `TTL_TOMBSTONE_OK`; `ARCHIVE_OK`/`UNARCHIVE_OK`; mobile TTL+archive | PARTIAL — P-256+TTL+archive PASS; Curve25519 OPEN |
| 9 | WebRTC + screen share | `CALL_SCREEN_SIGNAL_OK` | PARTIAL — signaling PASS; live picker OPEN |
| 10 | Me profile / privacy / search / verify / wipe | `ME_SMOKE_OK`; `HOME_VERIFY_OK` / `HOME_MEMBERS_OK` / `HOME_JOIN_SLUG_OK` / `HOME_WIPE_OK`; roster verify + join-by-slug | PARTIAL — verify+join UX PASS |
| 11 | Encrypted storage | `STORAGE_SMOKE_OK`; mobile `secure-kv` (expo-secure-store → AsyncStorage fallback) for note/session/device keys | PARTIAL — roundtrip+SecureStore path PASS; physical device E2E OPEN |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS |
| 13 | i18n + themes | `I18N_KEYS_OK` + `I18N_PARITY_OK` + `I18N_AUDIT_OK` + `PWA_THEME_OK` | PARTIAL — key parity PASS; native copy QA OPEN |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK`; `DEPLOY_DRY_RUN_OK` | PARTIAL — preflight+dry-run PASS; live account OPEN |
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
RUN_DEPLOY_DRY_RUN=1 bash scripts/deploy-check.sh
```

## Explicitly not claimed

- Full licensed Bible corpora in R2
- Production `@signalapp/libsignal-client` / Curve25519
- Live Endao/WeRead IdP (local mock-token only)
- Browser `getDisplayMedia` picker without user gesture
- Live Cloudflare account deploy with real resource IDs
