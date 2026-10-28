# Audit — 教会 / 社区（家） / 消息系统

**Date:** 2026-10-28 (Asia/Shanghai)  
**Scope:** `apps/api` home · chat · friends · comms · calls · keys; web Home/Chat; SECURITY.md / PRODUCT.md claims  
**Method:** static code review (routes, schema, client crypto). No live red-team.

---

## Executive summary

| Area | Verdict |
| --- | --- |
| **E2EE DMs** | Architecture sound: server stores `ratchetHeader` + `ciphertext` only; membership + friendship gates on DM send |
| **教会 Home / 论坛** | Feature-rich; **board content is server-plaintext** (by design for bulletin UX) — high risk under `hostile` mode |
| **入会** | Anyone who knows `slug` can self-join as **unverified** member — weak against enumeration / infiltration |
| **群聊** | Group create can add arbitrary `memberIds` without friendship check; fan-out is pairwise E2EE (OK) but metadata-heavy |
| **降级加密** | Client still has `degraded` conversation-seed path when keys missing — do not market as Signal-grade |
| **好友请求留言** | `friend_requests.message` stored **plaintext** on D1 |

Overall: messaging ciphertext path matches SECURITY.md intent; **church community surface is the main confidentiality gap** relative to the hostile-jurisdiction threat model.

---

## 1. 教会 (Church)

### What exists

- Create church: **platform admin only** (`POST /v1/home/churches`) with `securityMode` `standard` | `hostile`
- Join: `POST /churches/join` (slug) / `POST /churches/:id/join` → member `verified: false`
- Roles: multi-role JSON (`elder`, `security_officer`, …) + legacy primary `role`
- Org tree, groups/departments, roster verify, 同工大会 mailing + notify, security mode patch
- Hostile join/create applies privacy floors (`applyHostilePrivacyFloors*`)

**Key files:** `apps/api/src/routes/home.ts`, `apps/api/src/services/church-access.ts`, `apps/api/src/db/schema.ts` (`churches`, `church_members`, `church_groups`)

### Findings

| ID | Sev | Finding |
| --- | --- | --- |
| C1 | **P0** | **Open join by slug/id** — no invite token, no admin approval gate before membership row exists. Unverified still sees some home surfaces; infiltrator metadata/presence. |
| C2 | **P1** | `securityMode` change restricted to **platform** admin, not church 安全官 — churches cannot self-escalate to hostile without platform. |
| C3 | **P2** | Church `name` / `slug` plaintext in D1 — OK for directory; ensure hostile churches are not publicly listed (confirm directory endpoints). |
| C4 | **P2** | Verification is admin-driven (`verified: true`) — good; but UI must make “unverified” limits obvious everywhere. |

### Recommendations

1. **P0:** Invite-only or approval-required join for `hostile` (and optionally all churches): invite codes, admin approve queue, rate-limit slug probing.
2. **P1:** Allow church `security_officer` to set `securityMode` (with audit log).
3. **P1:** Document which boards/APIs unverified members can hit; tighten to notices-only until verified if product agrees.

---

## 2. 社区 / 家看板 (Forum & boards)

### What exists

- Boards: general / notices / group / 大道 collectable posts (poll, chain, survey, riddle, timed)
- Authz: membership required; group board checks `groupId` membership; moderators pin/readonly/soft-delete
- External media URL allowlist; `mediaKey` ownership check
- Client: `HomePage.tsx` + Dadao panel

### Findings

| ID | Sev | Finding |
| --- | --- | --- |
| F1 | **P0** (hostile) | `forum_posts.title` / `body` / response `payloadJson` are **plaintext** on D1 — operators & compelled access see pastoral/organizational content. Contradicts SECURITY.md spirit for P2/P4-class sensitive community speech under hostile threat model. |
| F2 | **P1** | Coworker-assembly **notify** title/body plaintext in inbox/board path. |
| F3 | **P2** | Riddle `answerHash` is hashed (good); survey/chain answers still plaintext JSON. |
| F4 | **P2** | Soft-delete (`deletedAt`) — confirm hard purge / retention job exists for hostile churches. |

### Recommendations

1. **P0 for hostile:** Either (a) client-encrypt board bodies with church-shared key held only by members, or (b) product-label boards as **non-confidential** and push sensitive talk to E2EE chat only — and enforce in UX copy.
2. **P1:** Retention TTL + purge for deleted/expired posts; export of collectable responses should be moderator-scoped (already) and encrypted at rest if kept.

---

## 3. 消息系统 (Chat / friends / calls)

### Architecture (matches intent)

```
Client encrypt (product PQXDH / X3DH / degraded)
    → POST /v1/chat/conversations/:id/messages { ratchetHeader, ciphertext }
    → D1 messages (no plaintext column)
Disappearing → tombstone clears ciphertext
Favorites → client-encrypted blob on server
Calls → CallRoom DO signaling + TURN credentials (metadata visible)
```

**Key files:** `chat.ts`, `keys.ts`, `calls.ts`, `friends.ts`, `comms.ts`; web `secure-chat.ts`, `group-fanout.ts`, `ChatPanel.tsx`

### What works

- DM create/send requires **friendship**
- Message send/list requires **conversation membership**
- Read receipts gated by peer `shareReadReceipts` privacy
- Group fan-out: per-peer envelopes (server sees fan-out JSON shape, not plaintext)
- Comms badges: unread counts without message bodies
- Remote wipe command table + client poll path (ops-sensitive; keep audited)

### Findings

| ID | Sev | Finding |
| --- | --- | --- |
| M1 | **P0** | **`degraded` mode** derives from conversation seed when device keys missing — server operators who can push clients or MITM enroll could be stronger than claimed; marketing must not say Signal-grade until degraded is off by default / blocked. |
| M2 | **P1** | `POST /conversations` for `group`/`seminar` accepts any `memberIds` — **no friendship / same-church check** → spam groups / forced membership UX; victim gets ciphertext they may not want. |
| M3 | **P1** | `friend_requests.message` + inbox titles/bodies are **plaintext** (social graph + intro text). |
| M4 | **P1** | OpenE2EE / product path ≠ official libsignal (known OPEN gate) — document clearly in privacy policy. |
| M5 | **P2** | Group fan-out ciphertext is a JSON map of peer envelopes — size/metadata leakage (who is in the group is already known via members table). |
| M6 | **P2** | Call signaling + TURN: who/when metadata unavoidable; ensure DO state TTL stays short (SECURITY.md). |
| M7 | **P2** | Conversation `title` stored plaintext — OK for UX; avoid putting secrets in titles. |

### Recommendations

1. **P0:** Kill or hard-gate degraded mode in production builds (`VITE_ALLOW_DEGRADED_CHAT=false`); force key upload before send.
2. **P1:** Group create: require each member to accept invite, or same-church + friendship policy.
3. **P1:** Encrypt or drop friend-request free-text; prefer opaque “wants to connect”.
4. **P1:** Add integration tests for IDOR on message list (non-member → 403) — appears implemented; keep regression coverage.

---

## 4. Cross-cutting

| Topic | Note |
| --- | --- |
| Field encryption | Nicknames/signatures via `openField` / KEK — good for profile; forum bodies not covered |
| Platform vs church admin | Church create + security mode = platform; day-to-day verify/groups = church roles |
| Mobile parity | Expo `apps/mobile` has parallel crypto helpers; Capacitor uses web bundle — prefer one shell for store |
| Docs drift | PRODUCT Phase 3–4 largely landed; ROADMAP still reads aspirational — update after fixes |

---

## 5. Suggested fix order

1. Hostile join = invite/approve only  
2. Production: disable degraded chat  
3. Product decision: encrypt forum vs label non-confidential  
4. Group membership invites  
5. Friend-request message minimization  
6. Church 安全官 can toggle securityMode + retention jobs  

No code fixes in this audit PR beyond iOS prep scaffolding — implement as follow-up PRs.
