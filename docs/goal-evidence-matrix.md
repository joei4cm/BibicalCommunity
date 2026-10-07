# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web`, `apps/mobile`; typecheck | PARTIAL — apps present; device WebCrypto E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | Web BibleReader + `ANNOTATIONS_SMOKE_OK`; typography fontSize in reader | PARTIAL — API+web PASS; mobile parity in progress |
| 3 | Translations zh/en/ja mainstream | Registry ≥22 ids (NASB/CSB/NRSV/sigao/living-ja + licensed set); John.2 scaffolds; `JOHN2_MULTILANG_OK` | PARTIAL — catalog + scaffolds; full licensed corpora OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` | PASS (smoke) |
| 5 | Endao / WeRead by cross-login | `SSO_LOOP_OK` / `WEREAD_SSO_LOOP_OK`; `PARTNER_OAUTH_URL_OK` (env client_id) | PARTIAL — mock + URL wiring PASS; real IdP token exchange OPEN |
| 6 | Plans & devotion | `PLAN_CREATE_OK` + Playwright | PARTIAL |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK` | PARTIAL |
| 8 | E2EE chat TTL / archive | `KEYS_X3DH_CHAT_OK`; `KEYS_LIBSIGNAL_SEAM_OK` fail-closed | PARTIAL — P-256 PASS; Curve25519 libsignal OPEN |
| 9 | WebRTC + screen share | `CALL_SCREEN_SIGNAL_OK`; `webrtc.screen.test.ts` | PARTIAL — signaling PASS; live picker browser-gated OPEN |
| 10 | Me profile / privacy / search / verify / wipe | Me UI + `HOME_WIPE_OK` | PARTIAL |
| 11 | Encrypted storage | session-aes + annotation ciphertext | PARTIAL |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS (smoke) |
| 13 | i18n + themes | web/mobile locale + Me theme | PARTIAL |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK`; `DEPLOY_DRY_RUN_OK` (`RUN_DEPLOY_DRY_RUN=1`); local wrangler | PARTIAL — preflight+dry-run PASS; live CF account OPEN |
| 15 | Hostile privacy floors / wipe | `HOME_HOSTILE_OK` + wipeToken | PARTIAL |

## Smoke tokens (local wrangler :8787)

```bash
bash scripts/smoke-api.sh            # SMOKE_OK, JOHN2_*, SSO_*, ANNOTATIONS_SMOKE_OK, CALL_*
bash scripts/smoke-keys.sh           # KEYS_P2P_OK, KEYS_X3DH_CHAT_OK, KEYS_LIBSIGNAL_SEAM_OK
bash scripts/smoke-home.sh           # HOME_SMOKE_OK
bash scripts/smoke-study-embed.sh    # STUDY_EMBED_OK
bash scripts/smoke-partners-oauth.sh # PARTNER_OAUTH_URL_OK
bash scripts/deploy-check.sh         # DEPLOY_CHECK_OK
node scripts/smoke-call-signaling.mjs
```

## Explicitly not claimed

- Full licensed Bible corpora in R2
- Production `@signalapp/libsignal-client` / Curve25519
- Real Endao/WeRead OAuth token exchange against partner IdPs
- Browser `getDisplayMedia` picker E2E without user gesture
- Live Cloudflare account deploy (no API token in this environment)
