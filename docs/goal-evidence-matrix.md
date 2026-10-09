# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web` VitePWA; `PWA_BUILD_OK` (`manifest.webmanifest`+`sw.js`); Expo app + **`DEVICE_WEBCRYPTO_GATE_OK`** + **`DEVICE_PRODUCT_CHAT_OK`** + **`DEVICE_HANDSET_OPENE2EE_PRODUCT_OK`** + **`DEVICE_HANDSET_SHAPED_OK`** (iPhone viewport Playwright + OpenE2EE product companion); **`DEVICE_HANDSET_E2E_OPEN`** | PARTIAL — PWA+device crypto+handset-shaped+OpenE2EE PASS; physical handset E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | Web+mobile annotate/delete/decrypt + multi-color swatches; A±/serif/LH + Compact/Comfortable/Spacious presets; first-party reader skins via **theme-pack pipeline** (`THEME_PACK_PIPELINE_OK` / `READER_SKINS_OK`) | PARTIAL — core+colors+typography+pack pipeline PASS; licensed publisher pack content OPEN |
| 3 | Translations zh/en/ja mainstream | 22-id registry; **no TypeScript verse packs**; **whole-Bible download→local DB**; boot **和合本+NASB** (**`CORPUS_BOOT_VS_FULL_OK`**); WeDevote-style reader `/bible/{tid}/{book}/{chapter}` + mist-study open-folio UI; denser cuvs John.1 boot demo; paged transport (**`CORPUS_PAGED_DOWNLOAD_OK`**); Web+Expo **corpus catalog**; admin getbible→R2 (**`ADMIN_PD_CORPUS_OK`**); ESV external; **`CORPUS_LIVE_R2_OPEN`** | PARTIAL — boot+whole-Bible+WeDevote reader PASS; production CF R2 OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` | PASS |
| 5 | Endao / WeRead by cross-login | `SSO_LOOP_OK` / `WEREAD_SSO_LOOP_OK`; **`PARTNER_TOKEN_EXCHANGE_OK`** via local `mock-token`; **`PARTNER_IDP_HOST_PROBE_OK`** (documented authorize hosts reachable); **`PARTNER_LIVE_IDP_OPEN`** (live exchange needs partner secrets) | PARTIAL — local exchange + host probe PASS; live partner OAuth OPEN |
| 6 | Plans & devotion | `PLAN_CREATE_OK` + **`PLAN_CSV_SUBSCRIBE_OK`** + **`PLAN_DEVOTION_STEP_OK`** + **`DEVOTION_MATERIALS_OK`** (≥5 CC0) + **`DEVOTION_PACK_PIPELINE_OK`** (local+R2 stub) | PARTIAL — client binding + pack pipeline PASS; licensed third-party pack content OPEN |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK`; `HOME_MEMBERS_OK`; **`HOME_JOIN_SLUG_OK`**; **`HOME_FORUM_MEDIA_ACL_OK`** (R2 `mediaKey`, embed allowlist, group-board membership ACL) | PARTIAL — compose+roster+join+media/ACL PASS; live CF media ops OPEN |
| 8 | E2EE chat TTL / archive | `KEYS_X3DH_CHAT_OK`; `KEYS_LIBSIGNAL_SEAM_OK` + **`LIBSIGNAL_PACKAGE_PROBE_OK`** + **`LIBSIGNAL_NATIVE_ROUNDTRIP_OK`** (Node); **`LIBSIGNAL_WORKERS_FALLBACK_OK`** (x25519 + webcrypto + **product default OpenE2EE**) + **`LIBSIGNAL_OPENE2EE_PQXDH_OK`** + **`LIBSIGNAL_OPENE2EE_MSG_OK`** + **`LIBSIGNAL_OPENE2EE_PRODUCT_OK`** + **`PRODUCT_CHAT_OPENE2EE_OK`** + **`DEVICE_PRODUCT_OPENE2EE_OK`** (Workers/browser **default** `opene2ee`; Me UI; Kyber; MIT/Apache; **not** wire-compatible with Signal Messenger) + **`LIBSIGNAL_WORKERS_OPEN`** (no official WASM — see `docs/goal-open-blockers.md`); **`PRODUCT_CHAT_SIGNAL_OK`** + **`PRODUCT_CHAT_API_OK`**; `CURVE25519_X25519_OK`; `TTL_TOMBSTONE_OK`; `ARCHIVE_OK`/`UNARCHIVE_OK`; IndexedDB `lh-secure` | PARTIAL — product default OpenE2EE on Workers/browser PASS; official Workers libsignal OPEN (upstream) |
| 9 | WebRTC + screen share | `CALL_SCREEN_SIGNAL_OK`; `SCREEN_SHARE_GATE_OK` (secure-context + getDisplayMedia probe) | PARTIAL — signaling+capability gate PASS; live OS picker still user-gesture / device OPEN |
| 10 | Me profile / privacy / search / verify / wipe | `ME_SMOKE_OK` + **`ME_DEVICES_OK`** (list/revoke); `HOME_VERIFY_OK` / `HOME_MEMBERS_OK` / `HOME_JOIN_SLUG_OK` / `HOME_WIPE_OK`; roster verify + join-by-slug | PARTIAL — verify+join+device revoke UX PASS; recovery mnemonic stays client-only |
| 10b | Admin console (users / homes / groups / remote wipe) | `ADMIN_CONSOLE_OK` (`scripts/smoke-admin.sh`); platform bootstrap + church-scoped manage + admin remote wipe; **PD corpus seed** (`ADMIN_PD_CORPUS_OK` / Web corpus tab); Web `/app/admin` | PARTIAL — API+UI+smoke PASS; live CF admin ops OPEN |
| 11 | Encrypted storage | `STORAGE_SMOKE_OK`; mobile `secure-kv`; **`DEVICE_NOTE_CRYPTO_OK`** / **`DEVICE_PRODUCT_CHAT_OK`** / **`DEVICE_WEBCRYPTO_GATE_OK`** / **`DEVICE_HANDSET_SHAPED_OK`** | PARTIAL — roundtrip+SecureStore+product chat+handset-shaped PASS; physical handset E2E OPEN |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS |
| 13 | i18n + themes | `I18N_KEYS_OK` + `I18N_PARITY_OK` + `I18N_AUDIT_OK` + `I18N_NATIVE_COPY_OK` + `PWA_THEME_OK` + `READER_SKINS_OK` | PARTIAL — key parity + native differ-check PASS; human native QA OPEN |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK` (incl. migrations through `0007_corpus_d1_fallback`); `DEPLOY_DRY_RUN_OK`; **`LIVE_WORKERS_TEMPORARY_OK`** + **`LIVE_WORKERS_D1_CORPUS_OK`** (preview Workers+D1 corpus fallback when MEDIA unbound); **`scripts/live-r2-bootstrap.sh`** → `CORPUS_LIVE_R2_OK` when CF secrets present else **`CORPUS_LIVE_R2_OPEN`** | PARTIAL — preflight+dry-run+temp Worker+D1 corpus PASS; production R2 credentials OPEN |
| 15 | Hostile privacy floors / wipe | `HOME_HOSTILE_OK` + wipeToken; `ADMIN_REMOTE_WIPE_OK` + **`ADMIN_WIPE_R2_OK`** (R2 `media/{userId}/` delete + annotation ciphertext zero + cron expire); `SECURITY_AUDIT_OK` | PARTIAL — local wipe+R2 path PASS; live CF ops OPEN |

## Smoke tokens

```bash
bash scripts/smoke-api.sh            # SMOKE_OK, BIBLE_CORPUS_CATALOG_OK, NO_TS_FALLBACK_OK, PLAN_CSV_SUBSCRIBE_OK, ME_SMOKE_OK, SSO_*, …
bash scripts/smoke-me.sh             # ME_PROFILE_OK / ME_SEARCH_OK / ME_PRIVACY_HIDE_OK
bash scripts/smoke-admin.sh          # ADMIN_CONSOLE_OK / ADMIN_REMOTE_WIPE_OK / …
bash scripts/smoke-admin-pd-corpus.sh # ADMIN_PD_CORPUS_OK (getbible→R2; not TS packs)
node scripts/seed-r2-pd-full.mjs …    # PD_FULL_R2_SEED_OK (platform_admin; full WEB/KJV/ASV)
bash scripts/smoke-corpus-boot-scope.sh # CORPUS_BOOT_VS_FULL_OK (boot=cuvs+nasb whole-Bible)
bash scripts/smoke-corpus-paged-download.sh # CORPUS_PAGED_DOWNLOAD_OK (limit/after transport)
bash scripts/smoke-corpus-live-r2.sh   # CORPUS_LIVE_R2_OPEN (or OK with LIVE_R2=1 + LIVE_API_BASE)
bash scripts/live-r2-bootstrap.sh      # LIVE_R2_BOOTSTRAP_OK / CORPUS_LIVE_R2_OK (needs CF token)
bash scripts/smoke-storage.sh        # STORAGE_SMOKE_OK (session-aes / note / field / annotation)
bash scripts/smoke-home.sh           # HOME_JOIN_SLUG_OK / HOME_MEMBERS_OK / …
bash scripts/smoke-i18n-audit.sh     # I18N_AUDIT_OK
bash scripts/smoke-partners-oauth.sh # PARTNER_TOKEN_EXCHANGE_OK (local mock-token)
bash scripts/evidence-client-gates.sh # CRYPTO/SECURITY/I18N_PARITY/PWA_BUILD_OK → CLIENT_GATES_OK
bash scripts/smoke-corpus-inventory.sh # CORPUS_SCAFFOLD_INVENTORY_OK (JSON fixtures; no TS packs) / DEVOTION_MATERIALS_OK
bash scripts/smoke-corpus-packs.sh     # CORPUS_PACK_PIPELINE_OK (boot=2 cuvs+nasb; downloadable R2; noTsPacks)
bash scripts/smoke-corpus-local-db.sh  # CORPUS_LOCAL_DB_OK / CORPUS_CATALOG_OK / CORPUS_DOWNLOAD_OK (whole-Bible download→DB)
bash scripts/smoke-corpus-json-import.sh # CORPUS_JSON_FIXTURE_OK / CORPUS_JSON_IMPORT_OK (fixtures→R2/local DB)
# Foundation denser PD fixtures (#83/#84): in-repo WEB/KJV/ASV key chapters + optional full R2 walk
node scripts/fetch-pd-corpus-fixtures.mjs  # refresh in-repo WEB/KJV/ASV key-chapter fixtures (optional)
bash scripts/smoke-corpus-pd-full-r2.sh    # CORPUS_PD_FULL_R2_OK (full WEB→local R2→download, not git)
bash scripts/smoke-corpus-r2.sh        # CORPUS_R2_CHAPTER_OK (8 licensed tids + denser Acts.2/Ps.1/Prov.3/Matt.28/Eph.2/Col.3/Jas.1/Rev.21 put→get)
bash scripts/seed-r2-chapters.sh       # SEED_R2_OK + KEY_CHAPTER_R2_SEED_OK (JSON fixtures→R2; no TS packs)
bash scripts/smoke-bible-entitlement.sh # BIBLE_ENTITLEMENT_DEV_SKIP_OK / BIBLE_ENTITLEMENT_GRANT_OK
bash scripts/smoke-translation-resolve.sh # TRANSLATION_RESOLVE_PATH_OK (every registry id)
bash scripts/smoke-curve25519.sh       # CURVE25519_X25519_OK
bash scripts/smoke-libsignal-workers.sh # LIBSIGNAL_NATIVE_NODE_OK + LIBSIGNAL_WORKERS_FALLBACK_OK + LIBSIGNAL_OPENE2EE_PQXDH_OK + LIBSIGNAL_WORKERS_OPEN
bash scripts/smoke-product-chat-signal.sh # PRODUCT_CHAT_SIGNAL_OK (app product facade; optional PRODUCT_CHAT_API_OK)
bash scripts/smoke-device-crypto.sh     # DEVICE_WEBCRYPTO_GATE_OK + DEVICE_PRODUCT_CHAT_OK (+ DEVICE_HANDSET_E2E_OPEN)
bash scripts/smoke-handset-shaped.sh   # DEVICE_HANDSET_OPENE2EE_PRODUCT_OK + DEVICE_HANDSET_SHAPED_OK (iPhone viewport; physical E2E OPEN)
bash scripts/live-workers-temporary.sh # LIVE_WORKERS_TEMPORARY_OK (preview Worker+D1, no R2) + CORPUS_LIVE_R2_OPEN
bash scripts/seed-d1-corpus-boot.sh    # LIVE_WORKERS_D1_CORPUS_OK (D1 fallback; not R2)
bash scripts/smoke-partner-live-idp.sh # PARTNER_LIVE_IDP_OPEN (or OK with credentials)
bash scripts/smoke-goal-open-gates.sh  # GOAL_OPEN_GATES_OK + remaining OPEN token count
RUN_DEPLOY_DRY_RUN=1 bash scripts/deploy-check.sh
```



## Explicitly not claimed

- Full licensed Bible corpora in R2 (downloadable into client local DB; not TypeScript)
- Production `@signalapp/libsignal-client` on Workers/browser (Node native PQXDH roundtrip evidenced; Workers/browser remain X25519/WebCrypto; **Signal does not ship a web/WASM build**)
- Live Endao/WeRead IdP (local mock-token only)
- Browser `getDisplayMedia` picker without user gesture / insecure context
- Live Cloudflare account deploy with real resource IDs
- Licensed publisher Bible theme packs
- Physical handset E2E (handset-**shaped** Playwright PASS; USB/device farm required for `DEVICE_HANDSET_E2E_OK`)

## OPEN gate close book

See **`docs/goal-open-blockers.md`** for the four remaining tokens and exact secrets/commands.
Run `bash scripts/smoke-goal-open-gates.sh` for live remaining count.
