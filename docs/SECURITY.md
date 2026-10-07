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

Sensitive profile columns are stored as ciphertext with AES-256-GCM via WebCrypto in the Worker. AAD = `user_id || field_name || dek_id`.

| Deployment mode | P2 handling |
| --- | --- |
| `standard` | Worker field-level AES-GCM with DEK |
| `hostile` | Client encrypts P2 to the user’s identity key; D1 stores ciphertext only; Worker never decrypts |

### 3.3 R2 encrypted blobs (P3/P5)

- Object key: `r2://{env}/{church_id}/{user_id}/{object_id}` — no sensitive filenames.
- Body: ciphertext produced **on the client** for P3/P5 (preferred).
- Attachment keys live inside E2EE message payloads only.

### 3.4 Client-side E2EE for DMs / groups (Signal-style)

**Protocols:** X3DH for session setup + Double Ratchet for ongoing messages. Server is a **ciphertext courier** only.

Group messaging uses Sender Keys. Push notifications use generic localized titles only (no plaintext previews).

---

## 4. Auth: session tokens, device keys, keyed identity

- Opaque `user_id` (ULID) + `handle_hash = HMAC-SHA256(HANDLE_PEPPER, normalize(handle))`.
- Session tokens: 256-bit random, store **only SHA-256 hash** in D1; bound to `device_id`.
- Device private keys never leave the client secure store.
- Recovery: 24-word mnemonic client-side; server stores encrypted backup blob only.

---

## 5. WebRTC: auth + signaling only

| Component | Responsibility |
| --- | --- |
| Worker API | Authenticate; authorize membership; mint call tokens |
| Durable Object `CallRoomDO` | Fan-out SDP/ICE; enforce max participants |
| Clients | WebRTC media is **P2P** |
| TURN | Connectivity fallback only — relay encrypted SRTP |

No media bytes traverse Workers, DO, D1, or R2. No server-side call recording by default.

---

## 6. Disappearing messages

- Server stores ciphertext + `expires_at` only.
- Clients enforce TTL, secure-delete local plaintext, emit encrypted delete receipts.
- Cron/Queue sweeps expired ciphertext and R2 attachments.
- Screenshot risk is disclosed in UI (zh/en/ja); disappearing is best-effort.

---

## 7. Remote wipe (MDM-like)

1. Admin/user issues wipe → `wipe_commands` row + push/poll delivery.
2. Client deletes keys, local DB, caches → ACK.
3. Server revokes sessions, zeros ciphertext blobs, deletes R2 objects, revokes device keys.
4. Server **cannot** decrypt past E2EE content — wipe is destruction, not archival.

---

## 8. Search & discovery privacy

Defaults (`hostile` mode): handle discovery off, phone discovery off, directory off, message requests admin-approved, receipts/typing/last-active off. Church policy can force floors. Global people search disabled in hostile mode. Note search is on-device only.

---

## 9. Security audit checklist

- No P3/P4 plaintext in D1/R2/DO/Queues/logs.
- Session tokens hashed; device revoke triggers wipe.
- TURN credentials short-lived; signaling purged after call.
- Wipe tombstones remove ciphertext bytes.
- Push notifications contain no message plaintext.
- Production log redaction rejects `ciphertext`, `token`, `sdp`, `note_body`, etc.
- Separate KEK for staging vs production.

---

## 10. What NOT to do

1. Do not log plaintext messages, notes, or profile secrets.
2. Do not store server-side recordings of private calls.
3. Do not put plaintext message previews in push payloads.
4. Do not run server-side FTS on E2EE bodies or private notes.
5. Do not reuse one-time prekeys.
6. Do not ship key escrow or silent lawful-intercept decrypt hooks.
7. Do not store recovery mnemonics on the server.
8. Do not retain ciphertext after wipe ACK.
9. Do not decrypt customer ciphertext in support tools.
10. Do not paste production D1 dumps into tickets or LLM prompts.

---

## Appendix — Cloudflare mapping

| Concern | Primitive |
| --- | --- |
| API / auth | Workers |
| Ciphertext + sessions | D1 |
| Encrypted media | R2 |
| Call signaling | Durable Objects |
| Expiry & wipe sweeps | Cron Triggers + Queues |
| Secrets | Secrets Store / `wrangler secret` |

When behavior and this document disagree, **fix the more restrictive interpretation**, then update code or this document in the same PR.
