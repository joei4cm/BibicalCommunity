# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web` VitePWA; `PWA_BUILD_OK` (`manifest.webmanifest`+`sw.js`); Expo app + crypto gate | PARTIAL — PWA build PASS; physical device WebCrypto E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | Web+mobile annotate/delete/decrypt; `ANNOTATIONS_SMOKE_OK` | PARTIAL — core PASS; multi-color polish OPEN |
| 3 | Translations zh/en/ja mainstream | 22-id registry; John + Gen/Matt/Ps scaffolds; `MULTI_BOOK_SCAFFOLD_OK` | PARTIAL — catalog + scaffolds; full licensed corpora OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` | PASS |
| 5 | Endao / WeRead by cross-login | `SSO_LOOP_OK` / `WEREAD_SSO_LOOP_OK`; **`PARTNER_TOKEN_EXCHANGE_OK`** via local `mock-token` | PARTIAL — local exchange E2E PASS; live partner IdP OPEN |
| 6 | Plans & devotion | `PLAN_CREATE_OK` + **`PLAN_CSV_SUBSCRIBE_OK`** (CSV import, public subscribe, progress) | PARTIAL — API smoke PASS; deeper devotion UX OPEN |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK` | PARTIAL |
| 8 | E2EE chat TTL / archive | `KEYS_X3DH_CHAT_OK`; `KEYS_LIBSIGNAL_SEAM_OK` | PARTIAL — P-256 PASS; Curve25519 OPEN |
| 9 | WebRTC + screen share | `CALL_SCREEN_SIGNAL_OK` | PARTIAL — signaling PASS; live picker OPEN |
| 10 | Me profile / privacy / search / verify / wipe | Me UI + `HOME_WIPE_OK` | PARTIAL |
| 11 | Encrypted storage | session-aes + note-crypto | PARTIAL |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS |
| 13 | i18n + themes | `I18N_KEYS_OK` + `PWA_THEME_OK` | PARTIAL — keys/themes PASS; full copy audit OPEN |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK`; `DEPLOY_DRY_RUN_OK` | PARTIAL — preflight+dry-run PASS; live account OPEN |
| 15 | Hostile privacy floors / wipe | `HOME_HOSTILE_OK` + wipeToken; `SECURITY_AUDIT_OK` | PARTIAL |

## Smoke tokens

```bash
bash scripts/smoke-api.sh            # SMOKE_OK, PLAN_CSV_SUBSCRIBE_OK, MULTI_BOOK_*, SSO_*, …
bash scripts/smoke-partners-oauth.sh # PARTNER_TOKEN_EXCHANGE_OK (local mock-token)
bash scripts/evidence-client-gates.sh # CRYPTO/SECURITY/I18N/PWA_BUILD_OK → CLIENT_GATES_OK
RUN_DEPLOY_DRY_RUN=1 bash scripts/deploy-check.sh
```

## Explicitly not claimed

- Full licensed Bible corpora in R2
- Production `@signalapp/libsignal-client` / Curve25519
- Live Endao/WeRead IdP (local mock-token only)
- Browser `getDisplayMedia` picker without user gesture
- Live Cloudflare account deploy with real resource IDs
