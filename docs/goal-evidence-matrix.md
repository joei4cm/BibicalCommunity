# LogosHome / 圣言家 — Goal Evidence Matrix

Living checklist for the `/goal` objective. Status is evidence-based only.

Legend: **PASS** = current tree + command output prove it; **PARTIAL** = scaffold/mock/path exists but production end-state incomplete; **OPEN** = required work remains.

| # | Requirement | Evidence (authoritative) | Status |
|---|-------------|--------------------------|--------|
| 1 | Web PWA + Expo multi-client | `apps/web`, `apps/mobile`; typecheck/smoke | PARTIAL — apps present; device WebCrypto E2E OPEN |
| 2 | Bible highlights / bookmarks / notes / typography | API bible routes + web BibleReader | PARTIAL — APIs wired; full UI polish OPEN |
| 3 | Translations zh/en/ja mainstream | `packages/bible` registry (17 ids); `JOHN2_MULTILANG_OK`; smoke chapter asserts | PARTIAL — catalog + John scaffolds; full licensed corpora OPEN |
| 4 | Study materials + Home embed | `STUDY_EMBED_OK` (`scripts/smoke-study-embed.sh`) | PASS (smoke) |
| 5 | Endao / WeRead by cross-login | SSO off → deep link; SSO on + mock → `SSO_LOOP_OK`; prod OAuth client_id | PARTIAL — mock closed loop PASS; real IdP token exchange OPEN |
| 6 | Plans & devotion | Plans API + Playwright create path | PARTIAL — API+UI smoke |
| 7 | Church Home forums / embeds | `HOME_SMOKE_OK` | PARTIAL |
| 8 | E2EE chat TTL / archive | chat routes + session-aes / X3DH courier `KEYS_X3DH_CHAT_OK` | PARTIAL — P-256 WebCrypto path PASS; Curve25519 libsignal OPEN |
| 9 | WebRTC + screen share | `CALL_WS_OK` / fan-out; `CALL_SCREEN_SIGNAL_OK`; `getDisplayMedia` in web | PARTIAL — signaling PASS; live display picker browser-gated OPEN |
| 10 | Me profile / privacy / search / verify / wipe | Me UI + wipeToken ack after session revoke | PARTIAL |
| 11 | Encrypted storage | crypto package session-aes + keys | PARTIAL |
| 12 | Auth-then-P2P | `KEYS_P2P_OK` + `KEYS_X3DH_CHAT_OK` | PASS (smoke) |
| 13 | i18n + themes | web/mobile locale catalogs + Me theme | PARTIAL |
| 14 | CF Workers + D1 + R2 deploy | `DEPLOY_CHECK_OK`; wrangler.production.toml; local wrangler | PARTIAL — preflight PASS; live CF account deploy OPEN |
| 15 | Hostile privacy floors / wipe | wipe + security-audit script | PARTIAL |

## Smoke tokens (local wrangler :8787)

```bash
bash scripts/smoke-api.sh           # SMOKE_OK, JOHN2_MULTILANG_OK, SSO_*, CALL_WS*
bash scripts/smoke-keys.sh          # KEYS_P2P_OK, KEYS_X3DH_CHAT_OK
bash scripts/smoke-home.sh          # HOME_SMOKE_OK
bash scripts/smoke-study-embed.sh   # STUDY_EMBED_OK
bash scripts/deploy-check.sh        # DEPLOY_CHECK_OK
node scripts/smoke-call-signaling.mjs  # CALL_SCREEN_SIGNAL_OK
```

## Explicitly not claimed

- Full licensed Bible corpora in R2
- Production `@signalapp/libsignal-client` / Curve25519
- Real Endao/WeRead OAuth token exchange against partner IdPs
- Browser `getDisplayMedia` picker E2E without user gesture
- Live Cloudflare account deploy (no API token in this environment)
