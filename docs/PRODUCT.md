# LogosHome (圣言家) Product Spec

## Positioning

One product for **read Scripture → plan devotion → belong to a church home → communicate safely**.  
Primary markets: Chinese-, English-, and Japanese-speaking churches. UX matches mainstream consumer apps (clean typography, calm themes, mobile-first) while meeting hostile-jurisdiction security needs.

## Information architecture

Bottom tabs (web + mobile):

1. **圣经 / Bible** — reader
2. **计划 / Plans** — reading plans & devotion
3. **家 / Home** — church community + chat entry
4. **我 / Me** — profile & settings

## 1. Bible Reader

Inspired by 微读圣经 / 主内圣经:

- Chapter view with verse numbers; swipe/keyboard nav; book/chapter picker
- **Highlights** (multi-color), **bookmarks**, **notes** (synced as encrypted blobs)
- Typography: font family, size, line height, margins; layout: single / dual translation
- Translation picker (zh/en/ja mainstream list)
- Study materials panel (open commentaries, cross-refs) when licensed/available
- External: 恩道 / 微读书城 — gated by `ENDAO_SSO_ENABLED` / `WEREAD_SSO_ENABLED` (and mock IdP for local): **SSO on** → OAuth authorize URL (+ mock callback); **SSO off** → plain deep link with verse `ref` only (no fake cross-login)

## 2. Plans & Devotion

- Create plan (title, description, visibility, day entries)
- Subscribe to others’ public/church plans
- **CSV import** columns: `day,ref,title,note` (e.g. `1,John.1,Word became flesh,`)
- Online edit of owned plans
- Devotion flow: Pause → Read → Reflect → Pray → Act (configurable steps)
- Open devotion materials catalog (public domain / CC)

## 3. Home (Church)

**Entry:** after login, show all churches the user belongs to (0..n).

### 3A Forum

- Subforums: church notices, group spaces (if member), general
- Posts: text, images (R2), external audio/video embeds (iframe/providers allowlist)
- Roles: member / leader / admin

### 3B Private messages

- DM + group chat, E2EE
- Group owner: disappearing message policy
- Personal archive / favorites (local + encrypted backup)
- Calls: 1:1 and group WebRTC; screen share / interactive canvas where platform allows
- Server: auth + signaling only

## 4. Me

- Fields: signature, UID (immutable public id), nickname, legal name (sensitive)
- **Church verification badge** when admin verifies membership
- Privacy: discoverable by nickname/UID within allowed scopes
- Cross-church connect: add by nickname or UID if privacy allows
- Security: devices, recovery key, remote wipe self-service, theme, language

## Themes & i18n

- Languages: `zh-CN`, `en`, `ja` (UI + RTL-ready layout hooks)
- Themes: `day`, `sepia`, `night`, `highContrast` — CSS variables, no purple-default cliché
- Brand: warm parchment + deep ink teal accent for reading calm; brand name hero on marketing/landing only

## Success metrics (product)

- D1/WAU readers completing a plan day
- % messages E2EE (target 100% of DM/group)
- Wipe ACK latency
- Crash-free sessions on web/mobile
