# LogosHome Roadmap

All features are in scope. Delivery is phased so each phase ships a usable vertical slice.

## Phase 0 — Foundation (landed)

- Monorepo: api / web / mobile / shared / bible / crypto / ui
- Architecture + security docs
- D1 schema (+ groups, favorites, media)
- Auth sessions, field-encrypted profile, privacy search, church verify
- Reader: book/chapter, dual-pane, typography, notes/highlights, study panel, Endao/WeRead
- Plans: CSV, edit, subscribe, public/subscriptions, devotion steps + open materials
- Home: churches, boards, embeds, ChatPanel (AES-GCM session crypto, TTL, archive, favorites)
- Calls: DO signaling + screen-share helpers; R2 media proxy
- Expo tabs parity; i18n zh/en/ja; themes; CI

## Phase 1 — Reader product

- Full chapter UX, highlights/bookmarks/notes sync (client encrypt)
- Typography & dual-pane
- Licensed translation pipeline via R2 entitlements
- Endao/WeRead deep-link adapters

## Phase 2 — Plans & devotion

- CRUD plans, subscribe, CSV import/export
- Devotion step engine + open materials pack

## Phase 3 — Church Home forum

- Multi-church membership, groups, notices, embeds
- Admin verification flows

## Phase 4 — Secure messaging

- Production X3DH + Double Ratchet
- Disappearing messages, archive
- CallRoom DO + TURN credentials
- Screen share on web; mobile as platform allows

## Phase 5 — Hardening & productization

- Hostile mode defaults, remote wipe E2E tests
- Security audit checklist automation
- Store builds, PWA install, ops runbooks
- Partner SSO if Endao/WeRead support OAuth

## Dependency notes

- Bible licensing is legal/ops, not only eng — ship PD + external links first.
- True E2EE requires mobile secure storage + web non-extractable keys before marketing “Signal-grade”.
