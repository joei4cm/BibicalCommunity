# Audit — 教会 / 社区（家） / 消息系统

**Date:** 2026-10-28 (Asia/Shanghai)  
**Scope:** `apps/api` home · chat · friends · comms · calls · keys · media; web Home/Chat; SECURITY.md / PRODUCT.md claims  
**Method:** static code review (routes, schema, client crypto). No live red-team.  
**Deep pass:** [Audit church/home API](bc-d006b7bb-b665-53a9-82d8-823df7eead45) · [Audit messaging/E2EE](bc-7c1fc491-4e1c-5e89-85ef-d57f26dff7d6)

---

## Executive summary

| Area | Verdict |
| --- | --- |
| **E2EE DMs (product/X3DH path)** | Ciphertext courier is real: D1 stores `ratchetHeader` + `ciphertext`; DM gated by friendship + membership |
| **Authz holes (P0)** | **Media GET/PUT IDOR**, **call signaling without membership**, **group-board list/respond leaks** — fix before marketing hostile mode |
| **教会入会** | Slug/id open join → unverified but content-capable member |
| **论坛** | Titles/bodies/surveys **plaintext** on D1; assembly notify can leak `audienceUserIds` on notice posts |
| **降级加密 / 附件** | `degraded` seed ≈ operator-decryptable; chat attachments uploaded as **plaintext R2** |
| **SECURITY.md drift** | Sender Keys, sealed sender, call max peers, hostile client-only P2 — **claimed, not shipped** |

Overall: DM ciphertext path is credible when product keys work; **do not claim hostile-jurisdiction readiness** until media/call/board authz and degraded/media plaintext are closed.

---

## 1. 教会 (Church)

### What exists

- Create church: **platform admin only** (`POST /v1/home/churches`) with `securityMode` `standard` | `hostile`
- Join: `POST /churches/join` (slug) / `POST /churches/:id/join` → member `verified: false`
- Roles: multi-role JSON (`elder`, `security_officer`, …) + legacy primary `role`
- Org tree, groups/departments, roster verify, 同工大会 mailing + notify, security mode patch
- Hostile join/create applies privacy floors (`applyHostilePrivacyFloors*`) — floors incomplete vs SECURITY §3.2 (receipts/typing/last-active not forced off; Worker still `openField` for nicknames)

**Key files:** `apps/api/src/routes/home.ts`, `apps/api/src/services/church-access.ts`, `apps/api/src/db/schema.ts`

### Findings

| ID | Sev | Finding |
| --- | --- | --- |
| C1 | **P0** | **Open join by slug/id** — no invite/approve before membership. Unverified still reads forum/org (membership ≠ verified). |
| C2 | **P1** | `securityMode` change = **platform** admin only, not church 安全官. |
| C3 | **P1** | Hostile floors incomplete vs SECURITY (Worker still decrypts P2; receipts/typing/last-active not forced off). |
| C4 | **P2** | No unique `(church_id, user_id)` on `church_members` — race duplicates possible. |
| C5 | **P2** | Me/Home UI: verification badge largely missing (`me.churches` / `verified` not surfaced). No self-leave church. |
| C6 | **P2** | `roles_json` plaintext — membership/role graph is a protected asset under SECURITY §1.1. |

### Recommendations

1. **P0:** Invite-only or approval queue for `hostile` (optionally all); quarantine unverified from boards/org-tree.
2. **P1:** Church 安全官 can set `securityMode` + audit log; extend hostile floors; stop Worker decrypt in hostile or amend docs.
3. **P2:** Unique membership index; Me verification badge; leave-church.

---

## 2. 社区 / 家看板 (Forum & boards)

### What exists

- Boards: notice / general / group + 大道 kinds (poll, chain, survey, riddle, timed)
- Authz helpers in `church-access.ts`; soft-delete / pin / readonly; embed allowlist
- Client: `HomePage.tsx`, `DadaoPanel.tsx`

### Findings

| ID | Sev | Finding |
| --- | --- | --- |
| F1 | **P0** (hostile) | Forum `title` / `body` / response `payloadJson` **plaintext** on D1. |
| F2 | **P0** | **Group-board list leak** — group ACL filter only when `board=group`; unfiltered `GET …/posts` can include other groups’ posts for any church member. |
| F3 | **P0** | **Respond ACL hole** — `POST /posts/:id/respond` checks church membership only; `GET /posts/:id` checks groupIds. Non-group members can vote/survey if they know `postId`. |
| F4 | **P0** | **Assembly notify roster leak** — `audienceUserIds` stored in notice `payloadJson` readable by all members. |
| F5 | **P1** | Any member can `POST` `board: "notice"` — not gated to moderators. |
| F6 | **P1** | Coworker-assembly notify title/body plaintext; assembly chat sync adds but does not prune departed conveners. |
| F7 | **P2** | Soft-delete retention / hard purge unclear; embed allowlist allows any `https` host with media extension. |

### Recommendations

1. **P0:** Always filter group posts by `ctx.groupIds`; mirror ACL on respond/export; remove `audienceUserIds` from member-visible notice payloads.
2. **P0/product:** Encrypt board bodies for hostile **or** label non-confidential and push sensitive talk to E2EE.
3. **P1:** Restrict notice writes to `canModeratePosts`; prune assembly chat membership.

---

## 3. Media (cross-cutting P0)

| ID | Sev | Finding |
| --- | --- | --- |
| R1 | **P0** | `PUT /v1/media/put/*` does **not** enforce `isOwnedMediaKey` — any authed user can write arbitrary keys. |
| R2 | **P0** | `GET /v1/media/*` returns object to **any** authed user who knows the key — no conversation/church ACL. |
| R3 | **P0** | Chat attachments upload **raw** bytes to R2 (`ChatPanel.sendAttachment`) — contradicts SECURITY P5 client-encrypted media. |

**Fix:** ownership on PUT; GET authorized by owner or conversation/forum membership (or signed short-lived URLs); client-encrypt attachment bodies with key only in E2EE payload.

---

## 4. 消息系统 (Chat / friends / calls / keys)

### Architecture

```
Client encrypt (product PQXDH / X3DH / degraded)
    → POST /v1/chat/conversations/:id/messages { ratchetHeader, ciphertext }
    → D1 messages (no plaintext column)
Group: pairwise fan-out blob (group-fanout:v1) — NOT Sender Keys
Calls: CallRoom DO signaling; media P2P — membership authz MISSING
```

### What works

- DM create/send requires friendship; message list/send requires membership
- Read receipts gated by `shareReadReceipts`; favorites client-encrypted
- Disappearing tombstone + cron sweep; wipe zeros ciphertext / sessions / media prefix (favorites/inbox leftovers)
- Generic push copy (no message plaintext in notifications)

### Findings

| ID | Sev | Finding |
| --- | --- | --- |
| M1 | **P0** | **`degraded` mode** — seed from `conversationId` + sorted user ids; **operators can decrypt**. Must fail-closed in production. |
| M2 | **P0** | **Calls:** `POST /v1/chat/calls` and WS upgrade do **not** verify conversation membership; `callId` often `call_${conversationId}` (guessable); DO has **no max participants**. |
| M3 | **P0** | **`GET /v1/keys/:userId`** — any session can fetch any bundle and **consume OPKs** (exhaustion / interference); no friend/church gate. |
| M4 | **P1** | Group/seminar create: arbitrary `memberIds`, no consent/friendship. |
| M5 | **P1** | No sealed sender; `senderDeviceId` always server-visible. Groups ≠ Sender Keys (doc mismatch). |
| M6 | **P1** | Friend-request `message` + inbox title/body plaintext. |
| M7 | **P1** | Mobile degraded seed asymmetry vs web sorted-pair (reliability); Open Relay TURN fallback risky in prod. |
| M8 | **P2** | Local `lh.msg.*` / note keys in clear storage; typing privacy toggle without typing API; wipe collateral on shared threads. |

### Recommendations

1. **P0:** Fail closed on degraded; authorize calls + unguessable callId + max peers; gate/rate-limit key fetch + OPK consume; fix media R1–R3.
2. **P1:** Group invites; document or implement Sender Keys; minimize friend-request text; disable Open Relay in production.
3. **P2:** Align SECURITY.md claims with shipped crypto or treat mismatches as release blockers.

---

## 5. SECURITY.md / PRODUCT.md claim matrix (selected)

| Claim | Status |
| --- | --- |
| X3DH + DR courier-only | **Partial** — product path yes; degraded no |
| Group Sender Keys | **Missing** — pairwise fan-out |
| Sealed sender | **Missing** |
| Client-encrypted R2 media (P5) | **Missing** |
| Call membership + max participants | **Missing** |
| Hostile P2 client-only (Worker never decrypts) | **Missing** |
| Church verification badge on Me | **API yes, UI no** |
| Disappearing + wipe sweeps | **Mostly** (server); client leftovers |

---

## 6. Suggested fix order (revised)

1. **Media ACL + client-encrypt attachments** (R1–R3)  
2. **Call membership + unguessable callId + max peers** (M2)  
3. **Group board list/respond ACL + strip audienceUserIds** (F2–F4)  
4. **Fail-closed degraded + gate OPK fetch** (M1, M3)  
5. Hostile invite/approve join (C1)  
6. Notice write moderation + forum confidentiality product decision (F1, F5)  
7. Group chat invites; SECURITY.md claim sync  

This audit PR remains docs/config only; implement as follow-up fix PRs.
