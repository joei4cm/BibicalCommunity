# LogosHome (圣言家) Security Model

**Languages:** 中文 / English / 日本語  
**Stack:** Cloudflare Workers · D1 · R2 · Durable Objects · Queues · WebCrypto  
**Audience:** engineers, church admins, security reviewers

This document is the authoritative security design for LogosHome. Treat it as implementable requirements, not aspirational guidance. Code that contradicts this document is a defect.

---

## 1. Threat model (churches in hostile jurisdictions)

### 1.1 Assets we protect

| Asset | Why it matters |
| --- | --- |
| Member identity & contact graph | Maps who worships with whom |
| Private notes / journal | Spiritual content that may be incriminating in some jurisdictions |
| E2EE DMs & group messages | Pastoral care, prayer requests, organizing |
| Media (voice/video/files) | Same sensitivity as messages |
| Device keys & session tokens | Possession = account |
| Church membership / role lists | Organizational structure of a faith community |
| Call signaling metadata | Who talked to whom, when |

### 1.2 Adversaries

1. **Hostile state / law-enforcement compelled access** — Subpoena, seizure of servers, coercion of Cloudflare account holders, or compelled key disclosure from operators.
2. **Network observers** — ISP, national firewall, captive portals: TLS termination attempts, traffic correlation, DNS snooping.
3. **Compromised or coerced operators** — LogosHome staff, church admins, or anyone with Workers/D1/R2 dashboard access.
4. **Device seizure** — Phone/laptop taken unlocked or with biometric unlock forced.
5. **Malicious peers** — Fake members, compromised accounts inside a church.
6. **Supply-chain / dependency** — Malicious npm package, poisoned Worker build, tampered client update.
7. **Curious admins / insider misuse** — Legitimate church admin overreaching (pastoral confidentiality).

### 1.3 Assumptions

- Cloudflare edge TLS is trusted for transport confidentiality against passive network adversaries.
- Cloudflare (and anyone with account access) **can** read D1 rows, R2 object bytes, Durable Object state, and Worker logs. Design so that reading those does **not** yield message plaintext or note plaintext.
- Clients may be compromised; we mitigate blast radius (per-device keys, remote wipe, disappearing messages), we do not claim perfect endpoint security.
- Bible text and published liturgy are **public** or licensed content — confidentiality is not the goal for that corpus.

### 1.4 Trust boundaries

```
┌──────────────┐     TLS      ┌─────────────────────────────┐
│  Client app  │◄────────────►│  Cloudflare Worker (API)    │
│  (key store) │              │  + Durable Objects (signal) │
└──────┬───────┘              │  + D1 / R2 / Queues         │
       │                      └──────────────┬──────────────┘
       │ E2EE (X3DH+DR)                       │
       │ plaintext never crosses              │ ciphertext + metadata only
       ▼                                      ▼
  Peer clients                         Operators / Cloudflare
                                       (untrusted for content)
```

**Rule:** Anything that would harm a member if disclosed to an operator or compelled third party must be end-to-end encrypted or never leave the device.

### 1.5 Out of scope (explicit)

- Perfect anonymity against global passive adversaries (Tor-grade).
- Protecting against a fully compromised client OS with malware.
- Legal advice for specific jurisdictions — churches should consult counsel; this doc describes technical controls only.

---

## 2. Data classification

Assign every field and blob a class. Storage, logging, retention, and access control follow the class.

| Class | Examples | Server may see plaintext? | Storage | Retention |
| --- | --- | --- | --- | --- |
| **P0 Public** | Canonical Bible text, public reading plans, app chrome (zh/en/ja UI strings), open church directory entries marked public | Yes | D1 / R2 / KV / CDN cache | Long-lived; license-bound |
| **P1 Account metadata** | Opaque user id, keyed identity handle hash, locale (`zh`/`en`/`ja`), created_at, feature flags | Yes (minimize) | D1 | Account lifetime + short tombstone |
| **P2 Sensitive profile** | Display name, avatar, phone/email (if any), bio, church role labels | **No** — field-level encrypt at rest | D1 ciphertext columns | Account lifetime; wipe on remote wipe |
| **P3 Private notes** | Personal Bible notes, journals, bookmarks with private annotations | **No** — client-side encrypt; server stores ciphertext blob | R2 or D1 BLOB + envelope | User-controlled; wipeable |
| **P4 E2EE messages** | DM / group ciphertext, attachments pointers, sealed sender envelopes | **No** — ciphertext only | D1 message rows + R2 media | TTL / user delete / wipe |
| **P5 Media blobs** | Voice notes, images, files, encrypted call recordings **if ever offered** (default: never record) | **No** — encrypted object body | R2 | Same as owning message |
| **P6 Session & device secrets** | Session token hashes, device public keys, identity key fingerprints | Public keys: yes; private keys: **never on server** | D1 (pub + hashes); client secure store (priv) | Session TTL / device revoke |
| **P7 Signaling metadata** | SDP/ICE via DO, room membership, timestamps | Yes (necessary for connectivity) | Durable Object memory + short D1 audit | Minutes–hours; minimize |
| **P8 Admin / wipe control** | Wipe tokens, tombstone flags, admin audit events | Yes | D1 | Audit retention policy |

### 2.1 Classification rules for new features

1. Default new user-generated content to **P3** or **P4** until proven otherwise.
2. Never demote P3/P4 to P1/P2 without a written exception in this document.
3. Search indexes of P3/P4 content must be built **client-side** or over ciphertext blind indexes — never plaintext full-text on the server.
4. Product copy and Bible content stay P0; do not mix P0 and P4 in the same log line or analytics event.

### 2.2 Multilingual product note

UI strings and in-app help (zh/en/ja) are P0. User-authored content in any language inherits the content class (notes → P3, messages → P4), not the UI language.

---

## 3. Encryption at rest

### 3.1 Key hierarchy (Cloudflare-oriented)

```
KEK_master (Cloudflare Secrets Store / Wrangler secret)
    └── DEK_profile   (AES-256-GCM) — wraps P2 columns
    └── DEK_r2        (AES-256-GCM) — wraps R2 object encryption keys
    └── DEK_search    (optional HMAC key for blind indexes)

Client-only (never uploaded):
    Identity Key Pair (IK)
    Signed Prekey (SPK) + one-time prekeys (OPK)
    Double Ratchet session keys
    Note root key (per-user, in platform keystore)
```

**Workers secrets:** `KEK_MASTER`, rotated via Wrangler / Secrets Store. DEKs stored in D1 as `enc_dek` blobs wrapped by KEK. Rotation: generate new DEK → re-encrypt rows in batches (Queue consumer) → retire old DEK.

### 3.2 D1 field-level encryption (P2)

Sensitive profile columns are stored as:

```sql
-- illustrative
display_name_ct BLOB NOT NULL,      -- AES-256-GCM ciphertext
display_name_iv BLOB NOT NULL,      -- 12-byte IV
display_name_tag BLOB,              -- if not appended to ct
profile_dek_id TEXT NOT NULL,       -- which DEK version
```

**Algorithm:** AES-256-GCM via WebCrypto in the Worker. AAD = `user_id || field_name || dek_id` to prevent mix-and-match.

**Access path:**

1. Authenticated request → Worker loads wrapped DEK → unwrap with KEK → decrypt requested fields → return over TLS to the **owning user** or authorized admin of the same church (admin access is still ciphertext→plaintext in Worker memory; prefer showing only what pastoral role needs).
2. Prefer **client-held profile keys** for maximum hostility resistance: optional mode where P2 is encrypted to the user’s identity key so even Workers never see display names. Product default for high-risk churches: **client-side P2**.

**Implementable default for LogosHome:**

| Deployment mode | P2 handling |
| --- | --- |
| `standard` | Worker field-level AES-GCM with DEK |
| `hostile` | Client encrypts P2 to recipient/self keys; D1 stores ciphertext only; Worker never decrypts |

Church admins flip mode at church creation; document the tradeoff (search/admin UX vs. operator blindness).

### 3.3 R2 encrypted blobs (P3/P5)

- Object key: `r2://{env}/{church_id}/{user_id}/{object_id}` — no sensitive filenames.
- Body: ciphertext produced **on the client** for P3/P5 (preferred), or Worker-side envelope encrypt for server-mediated uploads that are not E2EE (e.g. public church bulletin media = P0/P1).
- Metadata headers (custom): `x-lh-class`, `x-lh-expiry`, `x-lh-content-type-enc` (encrypted content-type if revealing MIME would leak).
- **SSE-C / application envelope:** Prefer application-level AES-GCM with a per-object data key wrapped for the conversation participants (E2EE attachments) so R2’s stored bytes are useless alone.

**Attachment E2EE flow:**

1. Client generates `obj_key` (32 bytes).
2. Encrypt file with AES-256-GCM → upload ciphertext to R2 via Worker-issued **scoped pre-signed URL** (short TTL, PUT only, content-length cap).
3. Wrap `obj_key` inside the E2EE message payload (Double Ratchet) so only conversation members unwrap.
4. Worker stores R2 etag + size + expiry; **never** the `obj_key`.

### 3.4 Client-side E2EE for DMs / groups (Signal-style)

**Protocols:** X3DH for session setup + Double Ratchet for ongoing messages. Implementation lives in `packages/crypto` (pure TS, WebCrypto / libsodium WASM as needed). Server is a **ciphertext courier**.

#### 3.4.1 Server-visible tables (ciphertext courier)

```sql
-- prekey bundle (public material only)
device_keys(
  user_id, device_id,
  identity_key_pub,           -- Curve25519/X25519
  signed_prekey_pub, signed_prekey_sig, signed_prekey_id,
  registration_id,
  updated_at
)

one_time_prekeys(
  user_id, device_id, prekey_id, prekey_pub, consumed_at
)

messages(
  id, conversation_id,
  sender_device_id,
  ratchet_header BLOB,        -- opaque to server
  ciphertext BLOB,            -- opaque to server
  content_type TEXT,          -- "msg" | "receipt" | "wipe" | "control" (enum only)
  created_at, expires_at,     -- expiry metadata only
  deleted_for_all_at,
  tombstoned INTEGER DEFAULT 0
)
```

#### 3.4.2 Guarantees

- Server **never** sees plaintext message bodies, attachment keys, or note bodies in E2EE mode.
- Server **does** see: opaque user/device ids, conversation membership, message sizes, timestamps, expiry timestamps, ciphertext length (pad to buckets: 1KiB / 4KiB / 16KiB / 64KiB).
- Sealed sender (optional v2): hide sender id from server by encrypting envelope to recipient; delivery via conversation mailbox DO.

#### 3.4.3 Group messaging

Use Sender Keys (Signal groups model):

1. Each member distributes a sender key over pairwise Double Ratchet sessions.
2. Group ciphertext encrypted under sender key; server stores group ciphertext + membership list.
3. Membership changes → rotate sender key; old key marked superseded.

#### 3.4.4 What the Worker must not do

- No server-side search of message bodies.
- No server-side push notification previews containing plaintext (use “New message” / 「新消息」 / 「新しいメッセージ」 only, or encrypted push payloads decryptable only on device).
- No logging of `ciphertext` or ratchet headers at `info` level (debug dumps forbidden in production).

---

## 4. Auth: session tokens, device keys, keyed identity

### 4.1 Keyed identity

- Users have an opaque `user_id` (ULID) and a **keyed handle**: `handle_hash = HMAC-SHA256(HANDLE_PEPPER, normalize(handle))`.
- Display handles are P2 (encrypted); discovery uses `handle_hash` lookups.
- `HANDLE_PEPPER` is a Worker secret; prevents offline enumeration from a stolen D1 dump without pepper.
- Optional **username UX** in zh/en/ja; normalization: NFKC + casefold for Latin; preserve CJK as-is after trim.

### 4.2 Device keys

Each install registers a device:

| Field | Storage |
| --- | --- |
| `device_id` | D1 |
| Identity key pub + signed prekey bundle | D1 |
| Identity key priv + ratchet state | Client secure storage only (iOS Keychain / Android Keystore / Web Crypto non-extractable + IndexedDB wrapped) |
| Device name / platform | P2 encrypted or coarse enum (`ios`/`android`/`web`) |

**Device limit:** configurable per church (default 5). New device requires existing-device approval or recovery key in `hostile` mode.

### 4.3 Session tokens

1. Login / device attest → Worker issues session token: random 256-bit, store **only SHA-256 hash** in D1 (`sessions.token_hash`).
2. Client sends `Authorization: Bearer <token>` (or HttpOnly secure cookie on web with `Secure; SameSite=Lax`).
3. Token bound to `device_id` + `user_id`; rotation on privilege change and every 7 days (sliding).
4. Absolute lifetime: 30 days; refresh requires device key signature of a server nonce.
5. Revocation: delete session row; optional `sessions_revoked_before` watermark per user for mass logout.

### 4.4 Auth API surface (Workers)

| Route | Notes |
| --- | --- |
| `POST /v1/auth/register` | Rate-limited; creates user + first device; returns session |
| `POST /v1/auth/login` | Issues session; returns prekey upload reminder |
| `POST /v1/auth/logout` | Revokes current session |
| `POST /v1/auth/devices` | Register additional device (signed) |
| `DELETE /v1/auth/devices/:id` | Revoke device → remote wipe trigger for that device |
| `GET /v1/keys/:userId` | Fetch prekey bundle (public) |
| `PUT /v1/keys/prekeys` | Upload OPKs (authenticated) |

**Rate limits:** Cloudflare rate limiting + Durable Object token bucket per IP and per `user_id`. Failed auth: exponential backoff; no user-enumeration differences in response timing beyond constant-time compare on hashes.

### 4.5 Recovery

- **Recovery key:** 24-word mnemonic generated client-side; encrypts a backup of identity key material to R2 as P3 ciphertext. Server stores blob only.
- Losing all devices + recovery key = account content unrecoverable (by design in `hostile` mode). Document clearly in zh/en/ja onboarding.

---

## 5. WebRTC: auth + signaling only

### 5.1 Roles

| Component | Responsibility |
| --- | --- |
| Worker API | Authenticate caller; authorize conversation membership; mint short-lived call tokens |
| Durable Object `CallRoomDO` | Fan-out SDP offers/answers and ICE candidates to room members; track room membership; enforce max participants |
| Clients | WebRTC `RTCPeerConnection`; media (audio/video) is **P2P** |
| TURN | **Connectivity fallback only** — relay encrypted SRTP; operator must not inspect media |

### 5.2 Signaling path

1. `POST /v1/calls` → create `call_id`, bind to `conversation_id`, return DO stub id.
2. Client opens WebSocket / Hibernatable WS to `CallRoomDO` with session token.
3. DO verifies session → membership → accepts SDP/ICE JSON messages.
4. DO stores signaling messages **in memory** (or brief DO storage) with TTL ≤ call duration + 5 minutes; then purge.
5. No media bytes traverse Workers, DO, D1, or R2.

### 5.3 TURN policy

- Use Cloudflare Calls / third-party TURN with **time-limited credentials** minted by Worker (`username`/`credential` TTL ≤ 5 minutes).
- TURN credentials scoped to `call_id`.
- Configure TURN for relay of DTLS-SRTP only; disable any recording/compliance tapping features.
- Prefer direct ICE (host/srflx) before relay; log only ICE outcome class (`direct`/`relay`), never candidate IPs in production logs for `hostile` churches (optional config).

### 5.4 Forbidden

- No server-side SFU that mixes/decodes media unless a future feature is explicitly designed with E2EE insertable streams (and still treated as high risk).
- No storing SDP with raw ICE candidates in D1 long-term.
- No “call recording” feature by default; if ever added, it must be client-side E2EE to participants’ keys and opt-in per call — never silent server AVF/MP4 archives.

---

## 6. Disappearing messages (Snapchat / Signal style)

### 6.1 Model

- Sender (or conversation policy) sets `expires_at` or relative TTL (`ttl_seconds`).
- Server stores **ciphertext + expiry metadata only**; it does not interpret body.
- Clients enforce display TTL (view-once vs. timer-after-read) and send **delete receipts**.
- Server may hard-delete ciphertext rows after `expires_at` via scheduled Worker / Queue (defense in depth); clients must not rely on server alone.

### 6.2 Client enforcement

1. On receive: decrypt → render → start timer per message policy (`after_read` / `after_send`).
2. On expiry: securely delete plaintext from local DB (SQLCipher / encrypted SQLite); overwrite message row; remove cached media files.
3. Emit `content_type = "receipt"` control message: `{ type: "delete", message_id, reason: "ttl" }` encrypted to peers.
4. View-once media: decrypt to memory, display, delete local ciphertext copy after first successful view acknowledgment.

### 6.3 Server jobs

```text
Cron Trigger (every minute) → Queue "expiry-sweep"
  → DELETE FROM messages WHERE expires_at < now() OR tombstoned = 1
  → R2 delete for unreferenced attachment object_ids
```

### 6.4 Threat notes

- Recipients can screenshot; disappearing messages are **best-effort confidentiality against casual retention**, not a defense against a determined recipient. Disclose in UI (zh/en/ja).
- Server operators see that a message existed (metadata) until expiry sweep completes; minimize retention of delivery logs.

---

## 7. Remote wipe (MDM-like)

### 7.1 Triggers

- Church admin (role `admin` / `security_officer`) issues wipe for a user or device.
- User issues self-wipe (“logout all devices & erase”).
- Automatic: device reported lost; session anomaly (optional).

### 7.2 Control plane

```sql
wipe_commands(
  id, user_id, device_id NULL,  -- NULL = all devices
  issued_by, reason_code,       -- no free-text PII in reason
  wipe_token HASH,              -- random token, store hash
  issued_at, expires_at,
  status  -- pending|acked|completed|expired
)
```

**Delivery:**

1. **Push:** silent push / Web Push with wipe token reference (no sensitive payload).
2. **Poll:** `GET /v1/devices/wipe` every N seconds while app backgrounded / on launch / on WS reconnect.
3. Client verifies signature of wipe command (admin device signature or server signature over `wipe_token`).

### 7.3 Client wipe actions (mandatory order)

1. Stop UI; show wipe progress (localized zh/en/ja).
2. Delete Double Ratchet sessions, identity keys, note keys from secure storage.
3. Wipe local message DB, image caches, WebRTC recordings (none expected), clipboard if held.
4. Clear web storage / IndexedDB / service worker caches.
5. ACK `POST /v1/devices/wipe/ack` with device attestation.
6. Factory-reset app state to logged-out.

### 7.4 Server wipe actions

1. Revoke all sessions for target user/device.
2. Tombstone D1 message ciphertext: `tombstoned=1`, zero or delete `ciphertext` / `ratchet_header` blobs.
3. Enqueue R2 deletes for user’s private objects and E2EE attachments they uploaded (best-effort; group attachments shared with others follow conversation policy — prefer rekey + leave tombstones).
4. Consume outstanding one-time prekeys; mark device keys revoked.
5. **Cannot** decrypt or “recover” past E2EE content server-side — document this for admins. Wipe is destruction, not archival.

### 7.5 Limits

- Wipe does not erase data already copied out of the app by a peer.
- Wipe does not erase Cloudflare log history that already leaked plaintext (which must not exist — see §10).
- Legal holds: if a jurisdiction requires retention, that conflicts with wipe — product must not silently retain ciphertext under a fake wipe ACK. Prefer refusing wipe with an explicit error when a hold flag is set (enterprise only); default LogosHome has **no** silent retain.

---

## 8. Search & discovery privacy settings

### 8.1 Per-user settings (defaults safe)

| Setting | Default (`standard`) | Default (`hostile`) | Effect |
| --- | --- | --- | --- |
| `discoverable_by_handle` | on | off | Handle hash lookup |
| `discoverable_by_phone` | off | off | HMAC phone hash lookup |
| `show_in_church_directory` | members-only | off | Directory listing |
| `allow_message_requests` | church-only | admin-approved | Inbound DMs |
| `share_read_receipts` | on | off | Receipts |
| `share_typing_indicators` | on | off | Typing |
| `share_last_active` | approx | off | Last active |
| `include_notes_in_device_search` | on (local) | on (local) | Local-only |
| `cloud_search_notes` | off | off | Forbidden unless client-side index |

### 8.2 Church-level policy

Admins can force floors (e.g. require `discoverable_by_handle=off` for all members). Forced policy is pushed as signed config; clients display effective settings.

### 8.3 Implementation

- Directory queries return only users who opted in **and** share a church membership row.
- Phone/email discovery: store `HMAC(PEPPER, e164)` only; never store raw phone in D1 in `hostile` mode.
- Global people search: **disabled** in `hostile` mode.
- Analytics for discovery: counts only, never query strings that contain handles/phones.

### 8.4 Client-side note search

Private notes search runs on-device over decrypted indexes. If a cloud backup index exists, it must be an encrypted blind index (HMAC tokens per word) — never plaintext Elasticsearch/D1 FTS on note bodies.

---

## 9. Security audit checklist

Use this before each release and after major crypto changes. Check boxes in PR description.

### 9.1 Crypto & data

- [ ] No P4/P3 plaintext in D1, R2, DO storage, Queues, or Analytics Engine.
- [ ] Message padding to size buckets enabled.
- [ ] Prekey exhaustion alerts (OPK count low).
- [ ] DEK/KEK rotation runbook tested in staging.
- [ ] Attachment keys only inside E2EE payloads.
- [ ] Disappearing message sweep job healthy (Dead Letter Queue empty).

### 9.2 Auth & devices

- [ ] Session tokens stored hashed only.
- [ ] Device revocation triggers wipe path.
- [ ] Recovery key backup is client-encrypted.
- [ ] Rate limits on auth and prekey fetch.
- [ ] Constant-time compares for token/handle hashes.

### 9.3 Transport & WebRTC

- [ ] All API endpoints HTTPS-only; HSTS on web.
- [ ] Call DO rejects non-members.
- [ ] TURN credentials short-lived and scoped.
- [ ] No media upload to R2 from call path.
- [ ] Signaling purged after call.

### 9.4 Wipe & retention

- [ ] Admin wipe ACKed by test device in CI harness.
- [ ] Tombstone removes ciphertext bytes, not just a flag.
- [ ] R2 lifecycle rules align with `expires_at`.
- [ ] No “soft delete” retaining plaintext backups.

### 9.5 Privacy UX (zh/en/ja)

- [ ] Push notifications contain no message plaintext.
- [ ] Disappearing messages + screenshot warning copy localized.
- [ ] Discovery defaults match church mode (`standard`/`hostile`).
- [ ] Export/download of user data excludes other users’ E2EE plaintext (impossible server-side; client export only own decryptable data).

### 9.6 Engineering hygiene

- [ ] Production log redaction middleware rejects keys: `ciphertext`, `password`, `token`, `prekey`, `sdp`, `ice`, `note_body`.
- [ ] Wrangler secrets not printed in CI logs.
- [ ] Dependency audit (`npm audit` / Snyk) on `packages/crypto` and Workers.
- [ ] CSP on web app; no inline script in production.
- [ ] Mobile apps: certificate pinning optional policy for `hostile` churches.
- [ ] Threat model reviewed when adding any new metadata field.

### 9.7 Cloudflare-specific

- [ ] Least-privilege API tokens for CI deploy.
- [ ] D1 backups encrypted; access logged.
- [ ] R2 public access disabled; only Worker / signed URL.
- [ ] Durable Object alarms used for purge, not long-term content storage.
- [ ] WAF / bot management on auth routes.
- [ ] Separate Cloudflare accounts or strict RBAC for production vs. staging.

---

## 10. What NOT to do

**Hard prohibitions.** Violations are security bugs.

1. **Do not log plaintext messages, notes, or profile secrets** — not in `console.log`, not in Tail Workers, not in exception trackers, not in Analytics Engine.
2. **Do not store AVFs / MP4s / server-side recordings of calls.** No “archive this sermon call on R2” unless it is an explicit P0 public broadcast product with separate consent — never for DMs/pastoral calls.
3. **Do not put message previews in push payloads** in plaintext. Use generic localized titles only, or end-to-end encrypted push.
4. **Do not run server-side full-text search on E2EE bodies or private notes.**
5. **Do not keep ICE candidate address logs** in production for hostile-mode churches.
6. **Do not reuse prekeys**; delete OPKs on fetch/consume.
7. **Do not send plaintext “admin impersonation” messages** through a server inject path — admins are not gods over E2EE.
8. **Do not ship backdoors, key escrow, or “lawful intercept” decrypt hooks** in the E2EE client. If a government requires escrow, that is a product/legal fork — not a silent flag in crypto.
9. **Do not store recovery mnemonics on the server** in any form.
10. **Do not weaken `hostile` mode defaults** for growth metrics (discovery on, last-active precise, etc.) without church-visible disclosure.
11. **Do not mix P0 Bible CDN logs with authenticated user ids** in the same analytics stream.
12. **Do not retain ciphertext after wipe ACK** “just in case.”
13. **Do not decrypt customer ciphertext in support tools.** Support sees metadata and diagnostics only.
14. **Do not use the same KEK across staging and production.**
15. **Do not paste production D1 dumps into tickets, Slack, or LLM prompts.**

---

## Appendix A — Cloudflare mapping cheat sheet

| Concern | Cloudflare primitive |
| --- | --- |
| API / auth | Workers |
| Relational ciphertext + sessions | D1 |
| Encrypted media / note blobs | R2 |
| Call signaling | Durable Objects (Hibernatable WebSockets) |
| Expiry & wipe sweeps | Cron Triggers + Queues |
| Secrets (KEK, peppers) | Secrets Store / `wrangler secret` |
| Rate limiting | Rate Limiting / DO counters / WAF |
| Edge TLS | Cloudflare HTTPS |
| TURN | Cloudflare Calls or external TURN with short-lived creds |

## Appendix B — Incident severity (content)

| Severity | Example | Response |
| --- | --- | --- |
| S0 | Plaintext messages in logs or R2 | Page on-call; scrub logs; rotate tokens; notify affected churches |
| S1 | Session token leak | Mass revoke; force re-auth |
| S2 | Metadata over-retention | Purge; fix job; postmortem |
| S3 | Mis-set discovery defaults | Force policy push; user notification |

## Appendix C — Document control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-10-07 | Initial LogosHome security model |

When behavior and this document disagree, **fix the more restrictive interpretation**, then update either code or this document in the same PR.
