# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web` VitePWA; `PWA_BUILD_OK` (`manifest.webmanifest`+`sw.js`); Expo app + **`DEVICE_WEBCRYPTO_GATE_OK`** (polyfill+note+session+x25519) | PARTIAL — PWA+automated WebCrypto gate PASS; physical handset E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | Web+mobile annotate/delete/decrypt + multi-color swatches; A±/serif/LH + Compact/Comfortable/Spacious presets; first-party reader skins via **theme-pack pipeline** (`THEME_PACK_PIPELINE_OK` / `READER_SKINS_OK`) | PARTIAL — core+colors+typography+pack pipeline PASS; licensed publisher pack content OPEN |
| 3 | Translations zh/en/ja mainstream | 22-id registry; denser PD **John.3/14** / **Rom.8/12**; denser licensed **John.14** (vv.1–17+27) / **Rom.8** (vv.1–17+28/31/38–39) across cuvs/cuvt/rcuv/ccb/lzz/kougo/shinkaiyaku/shinKyoudou / **Isa.53** / **Heb.11** / **1John.4** / **Matt.5** (Beatitudes vv.1–12); zh/ja **John.14** across cuvs/**cuvt**/rcuv/ccb/lzz/shinkaiyaku/shinKyoudou; **cuvt/rcuv/ccb/lzz** + **shinkaiyaku/shinKyoudou** key chapters (**Matt.5/6**, **Gen.1**, **Ps.23**, **Rom.8/12**, **John.15**, **1John.4**) + **Heb.11** / **Isa.53** / **Acts.2** / **Ps.1** / **Prov.3** / **Mark.1** / **Exod.20** / **Luke.2** / **Deut.6** / **Gal.5** / **Phil.4** / **1Cor.13** / **Eph.2** / **Col.3** / **Jas.1** / **Matt.28** / **Rev.21** peer scaffolds (parity with cuvs/kougo teaching set); cuvs/kougo **Matt.5**/Rom.12/Heb.11/1John.4; **`CORPUS_R2_CHAPTER_OK`** multi-tid put→get (cuvs/cuvt/kougo/**rcuv/ccb/lzz/shinkaiyaku/shinKyoudou**); pack-driven R2 seed **`KEY_CHAPTER_R2_SEED_OK`** (`scripts/seed-r2-key-chapters-from-packs.mjs` ≥150 puts incl. full peer teaching/pastoral set; John.14/Matt.5/Rom.8 `source=r2` × 8 licensed tids); corpus-pack + reader hints; **`BIBLE_ENTITLEMENT_GRANT_OK`** / unit policy (`decideLicensedChapterAccess`: prod requires auth+grant; development skips) | PARTIAL — catalog + multi-tid scaffolds + pack→R2 key chapters + entitlement gate PASS; full licensed corpora + live CF OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` | PASS |
| 5 | Endao / WeRead by cross-login | `SSO_LOOP_OK` / `WEREAD_SSO_LOOP_OK`; **`PARTNER_TOKEN_EXCHANGE_OK`** via local `mock-token`; **`PARTNER_LIVE_IDP_OPEN`** gate documents live-IdP skip | PARTIAL — local exchange E2E PASS; live partner IdP OPEN |
| 6 | Plans & devotion | `PLAN_CREATE_OK` + **`PLAN_CSV_SUBSCRIBE_OK`** + **`PLAN_DEVOTION_STEP_OK`** + **`DEVOTION_MATERIALS_OK`** (≥5 CC0) + **`DEVOTION_PACK_PIPELINE_OK`** (local+R2 stub) | PARTIAL — client binding + pack pipeline PASS; licensed third-party pack content OPEN |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK`; `HOME_MEMBERS_OK`; **`HOME_JOIN_SLUG_OK`**; **`HOME_FORUM_MEDIA_ACL_OK`** (R2 `mediaKey`, embed allowlist, group-board membership ACL) | PARTIAL — compose+roster+join+media/ACL PASS; live CF media ops OPEN |
| 8 | E2EE chat TTL / archive | `KEYS_X3DH_CHAT_OK`; `KEYS_LIBSIGNAL_SEAM_OK` + **`LIBSIGNAL_PACKAGE_PROBE_OK`** + **`LIBSIGNAL_NATIVE_ROUNDTRIP_OK`** (Node); **`LIBSIGNAL_WORKERS_OPEN`** (`scripts/smoke-libsignal-workers.sh`) documents Workers/browser fallback to X25519/WebCrypto; `CURVE25519_X25519_OK`; `TTL_TOMBSTONE_OK`; `ARCHIVE_OK`/`UNARCHIVE_OK`; IndexedDB `lh-secure` | PARTIAL — Node native PQXDH PASS; Workers/browser native addon OPEN |
| 9 | WebRTC + screen share | `CALL_SCREEN_SIGNAL_OK`; `SCREEN_SHARE_GATE_OK` (secure-context + getDisplayMedia probe) | PARTIAL — signaling+capability gate PASS; live OS picker still user-gesture / device OPEN |
| 10 | Me profile / privacy / search / verify / wipe | `ME_SMOKE_OK` + **`ME_DEVICES_OK`** (list/revoke); `HOME_VERIFY_OK` / `HOME_MEMBERS_OK` / `HOME_JOIN_SLUG_OK` / `HOME_WIPE_OK`; roster verify + join-by-slug | PARTIAL — verify+join+device revoke UX PASS; recovery mnemonic stays client-only |
| 10b | Admin console (users / homes / groups / remote wipe) | `ADMIN_CONSOLE_OK` (`scripts/smoke-admin.sh`); platform bootstrap + church-scoped manage + admin remote wipe; Web `/app/admin` | PARTIAL — API+UI+smoke PASS; live CF admin ops OPEN |
| 11 | Encrypted storage | `STORAGE_SMOKE_OK`; mobile `secure-kv`; **`DEVICE_NOTE_CRYPTO_OK`** / **`DEVICE_WEBCRYPTO_GATE_OK`** | PARTIAL — roundtrip+SecureStore+automated WebCrypto PASS; physical handset E2E OPEN |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS |
| 13 | i18n + themes | `I18N_KEYS_OK` + `I18N_PARITY_OK` + `I18N_AUDIT_OK` + `I18N_NATIVE_COPY_OK` + `PWA_THEME_OK` + `READER_SKINS_OK` | PARTIAL — key parity + native differ-check PASS; human native QA OPEN |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK` (incl. migrations `0004_devotion_step` + `0005_platform_admin` + `0006_forum_media_key`); `DEPLOY_DRY_RUN_OK` | PARTIAL — preflight+dry-run PASS; live account OPEN |
| 15 | Hostile privacy floors / wipe | `HOME_HOSTILE_OK` + wipeToken; `ADMIN_REMOTE_WIPE_OK` + **`ADMIN_WIPE_R2_OK`** (R2 `media/{userId}/` delete + annotation ciphertext zero + cron expire); `SECURITY_AUDIT_OK` | PARTIAL — local wipe+R2 path PASS; live CF ops OPEN |

## Smoke tokens

```bash
bash scripts/smoke-api.sh            # SMOKE_OK, PLAN_CSV_SUBSCRIBE_OK, ME_SMOKE_OK, MULTI_BOOK_*, SSO_*, …
bash scripts/smoke-me.sh             # ME_PROFILE_OK / ME_SEARCH_OK / ME_PRIVACY_HIDE_OK
bash scripts/smoke-admin.sh          # ADMIN_CONSOLE_OK / ADMIN_REMOTE_WIPE_OK / …
bash scripts/smoke-storage.sh        # STORAGE_SMOKE_OK (session-aes / note / field / annotation)
bash scripts/smoke-home.sh           # HOME_JOIN_SLUG_OK / HOME_MEMBERS_OK / …
bash scripts/smoke-i18n-audit.sh     # I18N_AUDIT_OK
bash scripts/smoke-partners-oauth.sh # PARTNER_TOKEN_EXCHANGE_OK (local mock-token)
bash scripts/evidence-client-gates.sh # CRYPTO/SECURITY/I18N_PARITY/PWA_BUILD_OK → CLIENT_GATES_OK
bash scripts/smoke-corpus-inventory.sh # CORPUS_SCAFFOLD_INVENTORY_OK / DEVOTION_MATERIALS_OK
bash scripts/smoke-corpus-packs.sh     # CORPUS_PACK_PIPELINE_OK (local + R2 licensed stubs)
bash scripts/smoke-corpus-r2.sh        # CORPUS_R2_CHAPTER_OK (8 licensed tids + John.14/Matt.5/Rom.8 put→get)
bash scripts/seed-r2-chapters.sh       # SEED_R2_OK + KEY_CHAPTER_R2_SEED_OK (pack→R2 key chapters)
bash scripts/smoke-bible-entitlement.sh # BIBLE_ENTITLEMENT_DEV_SKIP_OK / BIBLE_ENTITLEMENT_GRANT_OK
bash scripts/smoke-translation-resolve.sh # TRANSLATION_RESOLVE_PATH_OK (every registry id)
bash scripts/smoke-curve25519.sh       # CURVE25519_X25519_OK
bash scripts/smoke-libsignal-workers.sh # LIBSIGNAL_NATIVE_NODE_OK + LIBSIGNAL_WORKERS_OPEN
bash scripts/smoke-device-crypto.sh     # DEVICE_WEBCRYPTO_GATE_OK
bash scripts/smoke-partner-live-idp.sh # PARTNER_LIVE_IDP_OPEN (or OK with credentials)
RUN_DEPLOY_DRY_RUN=1 bash scripts/deploy-check.sh
```


## Explicitly not claimed

- Full licensed Bible corpora in R2
- Production `@signalapp/libsignal-client` on Workers/browser (Node native PQXDH roundtrip evidenced; Workers/browser remain X25519/WebCrypto)
- Live Endao/WeRead IdP (local mock-token only)
- Browser `getDisplayMedia` picker without user gesture / insecure context
- Live Cloudflare account deploy with real resource IDs
- Licensed publisher Bible theme packs
