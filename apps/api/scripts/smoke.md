# LogosHome API smoke flows

Local: `pnpm --filter @logoshome/api dev` then replace `$BASE` / `$TOKEN`.

## Auth

```bash
BASE=http://127.0.0.1:8787

curl -sS -X POST "$BASE/v1/auth/register" \
  -H 'content-type: application/json' \
  -d '{"password":"password12345","nickname":"Ada","handle":"ada_test","locale":"en"}'
# → { token, userId, uid, deviceId }

TOKEN=<token from register>
AUTH="Authorization: Bearer $TOKEN"
```

## Seed church (admin bootstrap)

```bash
curl -sS -X POST "$BASE/v1/home/churches" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Grace Chapel","slug":"grace-chapel"}'
# → { id, name, slug, role: "admin" }

curl -sS "$BASE/v1/home/churches" -H "$AUTH"
```

## Chat conversations

```bash
# Create (memberIds can include self only for a solo/group seed)
curl -sS -X POST "$BASE/v1/chat/conversations" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"kind\":\"dm\",\"memberIds\":[\"$USER_ID\"],\"disappearingTtlSec\":3600}"
# → { id } (self always added as owner; pass peer userId for a real DM)

CONVO=<id>

curl -sS "$BASE/v1/chat/conversations" -H "$AUTH"
# → memberships for current user

curl -sS -X PATCH "$BASE/v1/chat/conversations/$CONVO" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d '{"disappearingTtlSec":86400,"archived":true}'
# owner only
```

## Privacy-scoped search

```bash
curl -sS "$BASE/v1/me/search?q=$UID" -H "$AUTH"
# discovers if target has discoverableByUid

curl -sS "$BASE/v1/me/search?q=some_handle" -H "$AUTH"
# handle search stub → { results: [] } (only handleHash stored)
```

## Wipe hardening

```bash
curl -sS -X POST "$BASE/v1/admin/wipe" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"userId\":\"$USER_ID\",\"reasonCode\":\"self\"}"
# tombstones user, clears message ciphertext in memberships,
# revokes devices, deletes sessions, returns wipeToken
```
