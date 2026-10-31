# Closed beta readiness (hundreds of daily users)

Target: internal / church closed beta with on the order of **hundreds** of daily
active users doing Bible reading, DMs, calls, assembly/community, and plans.

## Must configure before invite

1. **Real TURN relay (calls)**  
   Set Cloudflare Calls TURN (`TURN_CF_KEY_ID` + `TURN_CF_API_TOKEN`) **or**
   self-hosted coturn (`TURN_SECRET` + `TURN_URIS` with `turn:` / `turns:`).  
   Do **not** rely on STUN-only or `ALLOW_OPEN_RELAY_TURN` for production beta —
   many mobile networks need relay or calls fail.

2. **D1 migrations**  
   Apply through `0015_beta_comms_indexes.sql` (message indexes + `rate_limits`)
   and `0014_user_vault.sql` on production D1 before traffic.

3. **Secrets**  
   Strong `KEK_MASTER`, `HANDLE_PEPPER`, session-facing secrets; never log tokens
   or ciphertext payloads. Keep `PLATFORM_ADMIN_BOOTSTRAP_SECRET` unset in prod
   unless you intentionally bootstrap.

4. **CORS / Pages**  
   Prefer a fixed allowlist of web origins for production; mobile shells use the
   baked `VITE_API_BASE` Worker URL.

## What is safe on the server (by design)

| Data | Server sees plaintext? |
| --- | --- |
| Chat / DM bodies | **No** — E2EE ciphertext only |
| Notes / bookmarks / vault history | **No** — client AES-GCM blobs |
| Profile nickname etc. | Field-encrypted at rest (KEK) |
| Call media | **No** — WebRTC P2P; server only relays SDP/ICE |
| Membership, friend graph, call metadata | **Yes** — minimize; needed for product |

Operators / Cloudflare can still see **metadata** (who talked to whom, when).
That is documented in `SECURITY.md` — content confidentiality ≠ metadata
unlinkability.

## Performance posture (this release)

- Message list: indexed `(conversation_id, created_at)`, **bounded** `limit`
  (default 100), batch expire for disappearing messages.
- Community boards: indexed `(church_id, created_at)`, list capped (~100 + pinned),
  board index scans a recent window only.
- Rate limits (D1 counters): auth login/register, message send/get, call mint,
  TURN credentials, community post create.
- Chat clients already poll incrementally with `?after=`; full sync every ~30s
  now pulls a recent page instead of unbounded history.

## Call stability checklist

- [ ] TURN mint returns `hasRelay: true` in staging and prod
- [ ] DM call on cellular ↔ Wi-Fi works (relay path)
- [ ] Late accept still gets buffered offer (CallRoomDO)
- [ ] Caller ICE restart on `failed` / `disconnected` after answer
- [ ] Hangup clears buffered invite so re-call works

## Known limits (acceptable for hundreds, not millions)

- Soft realtime via HTTP poll (not push) — fine at this scale; watch D1
  read units if poll intervals drop below ~5s for all open threads.
- Rate limits are best-effort per Worker isolate + D1; pair with Cloudflare
  WAF / rate limiting rules at the zone for abuse.
- Note/vault decrypt key stays on device (`lh.noteKey.jwk`); multi-device
  decrypt requires the same key material on each device.
