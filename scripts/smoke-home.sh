#!/usr/bin/env bash
# Church Home path smoke: create church, board post, verify member, group, chat archive.
# Can be called from smoke-api.sh (reuses TOKEN/PEER/CID) or standalone against a live API.
set -euo pipefail
BASE="${1:-${BASE:-http://127.0.0.1:8787}}"
PASS="${SMOKE_PASS:-SmokeTestPass123!}"

if [[ -z "${TOKEN:-}" ]]; then
  HANDLE="homesmoke$(date +%s)"
  REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
    -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"HomeSmoke\",\"locale\":\"en\"}")
  TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  test -n "$TOKEN"
fi
AUTH="Authorization: Bearer $TOKEN"

if [[ -z "${PEER:-}" ]]; then
  H2="homepeer$(date +%s)"
  REG2=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
    -d "{\"handle\":\"$H2\",\"password\":\"$PASS\",\"nickname\":\"HomePeer\",\"locale\":\"en\"}")
  PEER=$(echo "$REG2" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
  TOKEN2=$(echo "$REG2" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  test -n "$PEER"
  test -n "$TOKEN2"
fi
AUTH2="Authorization: Bearer ${TOKEN2:?TOKEN2 required when PEER is set without TOKEN2}"

echo "== home create church (platform admin) =="
BOOTSTRAP_SECRET="${PLATFORM_ADMIN_BOOTSTRAP_SECRET:-dev-platform-admin-bootstrap}"
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"secret\":\"$BOOTSTRAP_SECRET\"}" \
  "$BASE/v1/admin/platform/bootstrap" >/dev/null || true
SLUG="smoke-church-$(date +%s)"
CHURCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke Church\",\"slug\":\"$SLUG\",\"securityMode\":\"standard\"}" \
  "$BASE/v1/home/churches")
echo "$CHURCH" | head -c 200; echo
CHURCH_ID=$(echo "$CHURCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CHURCH_ID"
echo "$CHURCH" | grep -q '"role":"admin"'
echo "HOME_CHURCH_OK"

echo "== home create board post (notice + general) =="
POST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"notice\",\"title\":\"Smoke notice\",\"body\":\"Hello church\"}" \
  "$BASE/v1/home/posts")
echo "$POST" | head -c 120; echo
echo "$POST" | grep -q '"id":"post_'
POST_ID=$(echo "$POST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
LIST=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=notice")
echo "$LIST" | grep -q "$POST_ID"
GPOST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"general\",\"title\":\"Smoke general\",\"body\":\"General board\"}" \
  "$BASE/v1/home/posts")
echo "$GPOST" | grep -q '"id":"post_'
GLIST=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=general")
echo "$GLIST" | grep -q "$(echo "$GPOST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
echo "HOME_POST_OK"

echo "== home peer join + verify member =="
JOIN=$(curl -sf -X POST -H "$AUTH2" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/home/churches/${CHURCH_ID}/join")
echo "$JOIN" | head -c 160; echo
echo "$JOIN" | grep -q '"role":"member"'
VERIFY=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"userId\":\"$PEER\"}" \
  "$BASE/v1/home/members/verify")
echo "$VERIFY" | head -c 160; echo
echo "$VERIFY" | grep -q '"verified":true'
CHLIST=$(curl -sf -H "$AUTH2" "$BASE/v1/home/churches")
echo "$CHLIST" | grep -q "$CHURCH_ID"
echo "$CHLIST" | grep -q '"verified":true'
echo "HOME_VERIFY_OK"
echo "== home members roster (admin) =="
ROSTER=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/members")
echo "$ROSTER" | head -c 240; echo
echo "$ROSTER" | grep -q "\"userId\":\"$PEER\""
echo "$ROSTER" | grep -q '"verified":true'
echo "$ROSTER" | grep -q '"uid"'
# Non-admin peer cannot list roster
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH2" "$BASE/v1/home/${CHURCH_ID}/members")
test "$CODE" = "403"
echo "HOME_MEMBERS_OK"
echo "== home join by slug =="
# Register a third user and join via public slug
H3="homeslug$(date +%s)"
REG3=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H3\",\"password\":\"$PASS\",\"nickname\":\"SlugJoin\",\"locale\":\"en\"}")
TOKEN3=$(echo "$REG3" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN3"
JOIN_SLUG=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN3" -H 'content-type: application/json' \
  -d "{\"slug\":\"$SLUG\"}" \
  "$BASE/v1/home/churches/join")
echo "$JOIN_SLUG" | head -c 200; echo
echo "$JOIN_SLUG" | grep -q "\"churchId\":\"$CHURCH_ID\""
echo "$JOIN_SLUG" | grep -q '"role":"member"'
echo "$JOIN_SLUG" | grep -q "\"slug\":\"$SLUG\""
# Idempotent re-join
JOIN_AGAIN=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN3" -H 'content-type: application/json' \
  -d "{\"slug\":\"$SLUG\"}" \
  "$BASE/v1/home/churches/join")
echo "$JOIN_AGAIN" | grep -q '"alreadyMember":true'
echo "HOME_JOIN_SLUG_OK"

echo "== home patch security → hostile =="
SEC=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"securityMode":"hostile"}' \
  "$BASE/v1/home/churches/${CHURCH_ID}/security")
echo "$SEC" | head -c 160; echo
echo "$SEC" | grep -q '"securityMode":"hostile"'
ME_AFTER=$(curl -sf -H "$AUTH2" "$BASE/v1/me")
echo "$ME_AFTER" | grep -q '"discoverableByHandle":false'
echo "HOME_SECURITY_PATCH_OK"

echo "== home create group =="
GROUP=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"name\":\"Smoke Group\"}" \
  "$BASE/v1/home/groups")
echo "$GROUP" | head -c 160; echo
echo "$GROUP" | grep -q '"id":"grp_'
GID=$(echo "$GROUP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$GID"
echo "HOME_GROUP_OK"

echo "== home group board ACL + mediaKey + embed allowlist =="
# Allowlisted youtube URL accepted
YPOST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"general\",\"title\":\"YT embed\",\"body\":\"watch\",\"externalMediaUrl\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}" \
  "$BASE/v1/home/posts")
echo "$YPOST" | grep -q '"id":"post_'
# Disallowed host rejected
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"general\",\"title\":\"Bad embed\",\"body\":\"no\",\"externalMediaUrl\":\"https://evil.example/track\"}" \
  "$BASE/v1/home/posts")
test "$CODE" = "400"
# R2 mediaKey on post
UPLOAD=$(curl -sf -X POST -H "$AUTH" "$BASE/v1/media/upload-url")
MKEY=$(echo "$UPLOAD" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
PUT=$(echo "$UPLOAD" | sed -n 's/.*"putUrl":"\([^"]*\)".*/\1/p')
curl -sf -X PUT -H "$AUTH" -H 'content-type: application/octet-stream' \
  --data-binary 'forum-attach' "$BASE$PUT" >/dev/null
MPOST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"general\",\"title\":\"With file\",\"body\":\"attached\",\"mediaKey\":\"$MKEY\"}" \
  "$BASE/v1/home/posts")
echo "$MPOST" | grep -q "\"mediaKey\":\"$MKEY\""
# Group board requires membership in groupId
GPOST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"group\",\"groupId\":\"$GID\",\"title\":\"Group only\",\"body\":\"members\"}" \
  "$BASE/v1/home/posts")
echo "$GPOST" | grep -q '"id":"post_'
GPID=$(echo "$GPOST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
GLIST=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=group")
echo "$GLIST" | grep -q "$GPID"
# Peer (not in group) cannot post to that group and cannot see it
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH2" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"group\",\"groupId\":\"$GID\",\"title\":\"Nope\",\"body\":\"x\"}" \
  "$BASE/v1/home/posts")
test "$CODE" = "403"
PLIST=$(curl -sf -H "$AUTH2" "$BASE/v1/home/${CHURCH_ID}/posts?board=group")
echo "$PLIST" | grep -vq "$GPID"
echo "HOME_FORUM_MEDIA_ACL_OK"

echo "== chat conversation archive =="
if [[ -z "${CID:-}" ]]; then
  CONVO=$(curl -sf -X POST "$BASE/v1/chat/conversations" -H "$AUTH" -H 'content-type: application/json' \
    -d "{\"kind\":\"dm\",\"memberIds\":[\"$PEER\"]}")
  CID=$(echo "$CONVO" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  test -n "$CID"
fi
ARCH=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"archived":true}' \
  "$BASE/v1/chat/conversations/${CID}")
echo "$ARCH" | head -c 200; echo
echo "$ARCH" | grep -q '"archived":true'
echo "HOME_ARCHIVE_OK"

# Call/screen signaling lives in smoke-api.sh; when home runs standalone, still prove DO fan-out.
if [[ "${SMOKE_HOME_CALLS:-1}" == "1" ]] && [[ "${SMOKE_SKIP_CALL_SIGNALING:-}" != "1" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/smoke-call-signaling.mjs" ]]; then
    echo "== call + screen signaling fan-out (from smoke-home) =="
    node "$SCRIPT_DIR/smoke-call-signaling.mjs" "$BASE"
  fi
fi

echo "== hostile church privacy floors =="
HSLUG="hostile-$(date +%s)"
HCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"Hostile Church\",\"slug\":\"$HSLUG\",\"securityMode\":\"hostile\"}" \
  "$BASE/v1/home/churches")
HCH_ID=$(echo "$HCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$HCH_ID"
curl -sf -X POST -H "$AUTH2" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/home/churches/${HCH_ID}/join" >/dev/null
ME2=$(curl -sf -H "$AUTH2" "$BASE/v1/me")
echo "$ME2" | grep -q '"discoverableByHandle":false'
echo "$ME2" | grep -q '"allowMessageRequests":"admin-approved"'
echo "HOME_HOSTILE_OK"

echo "== self wipe + wipeToken ack =="
ME=$(curl -sf -H "$AUTH" "$BASE/v1/me")
SELF=$(echo "$ME" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
WIPE=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"userId\":\"$SELF\",\"reasonCode\":\"self\"}" \
  "$BASE/v1/admin/wipe")
echo "$WIPE" | head -c 200; echo
WID=$(echo "$WIPE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
WTOK=$(echo "$WIPE" | sed -n 's/.*"wipeToken":"\([^"]*\)".*/\1/p')
test -n "$WID" && test -n "$WTOK"
ACK=$(curl -sf -X POST -H 'content-type: application/json' \
  -d "{\"wipeToken\":\"$WTOK\"}" \
  "$BASE/v1/admin/wipe/${WID}/ack")
echo "$ACK" | grep -q '"ok":true'
echo "HOME_WIPE_OK"

echo "HOME_SMOKE_OK"
