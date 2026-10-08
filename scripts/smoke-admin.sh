#!/usr/bin/env bash
# Admin console: platform bootstrap, church/user/group management, remote wipe.
# Standalone — registers its own admin + target users (does not reuse parent TOKEN).
set -euo pipefail
BASE="${1:-${BASE:-http://127.0.0.1:8787}}"
PASS="${SMOKE_PASS:-SmokeTestPass123!}"
BOOTSTRAP_SECRET="${PLATFORM_ADMIN_BOOTSTRAP_SECRET:-dev-platform-admin-bootstrap}"

echo "== admin console register admin + peer =="
HANDLE="adminsmoke$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"AdminSmoke\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
ADMIN_ID=$(echo "$REG" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
test -n "$ADMIN_ID"
AUTH="Authorization: Bearer $TOKEN"

H2="adminpeer$(date +%s)"
REG2=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H2\",\"password\":\"$PASS\",\"nickname\":\"AdminPeer\",\"locale\":\"en\"}")
PEER=$(echo "$REG2" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
TOKEN2=$(echo "$REG2" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$PEER"
test -n "$TOKEN2"
AUTH2="Authorization: Bearer $TOKEN2"

echo "== admin access before church (forbidden console) =="
ACCESS0=$(curl -sf -H "$AUTH" "$BASE/v1/admin/access")
echo "$ACCESS0" | grep -q '"canAccessConsole":false'
ME0=$(curl -sf -H "$AUTH" "$BASE/v1/me")
echo "$ME0" | grep -q '"canAccessAdminConsole":false'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE/v1/admin/churches")
test "$CODE" = "403"
echo "ADMIN_ACCESS_DENY_OK"

echo "== create church → church admin console =="
SLUG="admin-church-$(date +%s)"
CHURCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"Admin Smoke Church\",\"slug\":\"$SLUG\",\"securityMode\":\"standard\"}" \
  "$BASE/v1/home/churches")
CHURCH_ID=$(echo "$CHURCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CHURCH_ID"
ACCESS1=$(curl -sf -H "$AUTH" "$BASE/v1/admin/access")
echo "$ACCESS1" | grep -q '"canAccessConsole":true'
ME1=$(curl -sf -H "$AUTH" "$BASE/v1/me")
echo "$ME1" | grep -q '"canAccessAdminConsole":true'
CHLIST=$(curl -sf -H "$AUTH" "$BASE/v1/admin/churches")
echo "$CHLIST" | grep -q "\"id\":\"$CHURCH_ID\""
echo "$CHLIST" | grep -q '"platformAdmin":false'
# Peer (non-admin) still forbidden
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH2" "$BASE/v1/admin/churches")
test "$CODE" = "403"
echo "ADMIN_CHURCH_SCOPE_OK"

echo "== peer join + admin list/patch members =="
curl -sf -X POST -H "$AUTH2" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/home/churches/${CHURCH_ID}/join" >/dev/null
MEMBERS=$(curl -sf -H "$AUTH" "$BASE/v1/admin/churches/${CHURCH_ID}/members")
echo "$MEMBERS" | grep -q "\"userId\":\"$PEER\""
PATCH=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"verified":true,"role":"member"}' \
  "$BASE/v1/admin/churches/${CHURCH_ID}/members/${PEER}")
echo "$PATCH" | grep -q '"ok":true'
MEMBERS2=$(curl -sf -H "$AUTH" "$BASE/v1/admin/churches/${CHURCH_ID}/members")
echo "$MEMBERS2" | grep -q "\"userId\":\"$PEER\""
echo "$MEMBERS2" | grep -q '"verified":true'
echo "ADMIN_MEMBERS_OK"

echo "== admin groups create / rename / delete =="
GCREATE=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Admin Console Group"}' \
  "$BASE/v1/admin/churches/${CHURCH_ID}/groups")
echo "$GCREATE" | grep -q '"id":"cgrp_'
GID=$(echo "$GCREATE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$GID"
GLIST=$(curl -sf -H "$AUTH" "$BASE/v1/admin/churches/${CHURCH_ID}/groups")
echo "$GLIST" | grep -q "$GID"
GRENAME=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Renamed Admin Group"}' \
  "$BASE/v1/admin/groups/${GID}")
echo "$GRENAME" | grep -q '"ok":true'
echo "$GRENAME" | grep -q 'Renamed Admin Group'
GDEL=$(curl -sf -X DELETE -H "$AUTH" "$BASE/v1/admin/groups/${GID}")
echo "$GDEL" | grep -q '"ok":true'
GLIST2=$(curl -sf -H "$AUTH" "$BASE/v1/admin/churches/${CHURCH_ID}/groups")
echo "$GLIST2" | grep -vq "$GID" || {
  # empty groups array is fine
  echo "$GLIST2" | grep -q '"groups":\[\]'
}
echo "ADMIN_GROUPS_OK"

echo "== admin users list =="
USERS=$(curl -sf -H "$AUTH" "$BASE/v1/admin/users?churchId=${CHURCH_ID}")
echo "$USERS" | grep -q "\"userId\":\"$ADMIN_ID\""
echo "$USERS" | grep -q "\"userId\":\"$PEER\""
echo "ADMIN_USERS_OK"

echo "== platform bootstrap =="
BOOT=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"secret\":\"$BOOTSTRAP_SECRET\"}" \
  "$BASE/v1/admin/platform/bootstrap")
echo "$BOOT" | grep -q '"platformRole":"platform_admin"'
ACCESS2=$(curl -sf -H "$AUTH" "$BASE/v1/admin/access")
echo "$ACCESS2" | grep -q '"platformAdmin":true'
ME2=$(curl -sf -H "$AUTH" "$BASE/v1/me")
echo "$ME2" | grep -q '"platformAdmin":true'
echo "$ME2" | grep -q '"canAccessAdminConsole":true'
# Bad secret rejected
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH2" -H 'content-type: application/json' \
  -d '{"secret":"wrong-secret"}' \
  "$BASE/v1/admin/platform/bootstrap")
test "$CODE" = "403"
echo "ADMIN_PLATFORM_BOOTSTRAP_OK"

echo "== admin patch church security via console =="
SEC=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"securityMode":"hostile","name":"Admin Hostile Home"}' \
  "$BASE/v1/admin/churches/${CHURCH_ID}")
echo "$SEC" | grep -q '"ok":true'
echo "$SEC" | grep -q '"securityMode":"hostile"'
echo "ADMIN_CHURCH_PATCH_OK"

echo "== admin remote wipe peer (incl. R2 media + annotation zero) =="
# Seed a peer R2 object so wipe must report r2Deleted >= 1
UPLOAD=$(curl -sf -X POST -H "$AUTH2" "$BASE/v1/media/upload-url")
MKEY=$(echo "$UPLOAD" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
PUT=$(echo "$UPLOAD" | sed -n 's/.*"putUrl":"\([^"]*\)".*/\1/p')
test -n "$MKEY" && test -n "$PUT"
curl -sf -X PUT -H "$AUTH2" -H 'content-type: application/octet-stream' \
  --data-binary 'wipe-r2-probe' "$BASE$PUT" >/dev/null
# Seed an annotation ciphertext that wipe must zero
curl -sf -X POST -H "$AUTH2" -H 'content-type: application/json' \
  -d '{"translationId":"web","ref":{"book":"John","chapter":3,"verseStart":16},"kind":"note","ciphertext":"secret-note-blob","iv":"deadbeef"}' \
  "$BASE/v1/annotations" >/dev/null

WIPE=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"userId\":\"$PEER\",\"reasonCode\":\"admin\"}" \
  "$BASE/v1/admin/wipe")
echo "$WIPE" | head -c 280; echo
WID=$(echo "$WIPE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
WTOK=$(echo "$WIPE" | sed -n 's/.*"wipeToken":"\([^"]*\)".*/\1/p')
test -n "$WID" && test -n "$WTOK"
echo "$WIPE" | grep -q '"annotationsZeroed":true'
echo "$WIPE" | grep -qE '"r2Deleted":[1-9]'
echo "$WIPE" | grep -q "media/${PEER}/"
# R2 object gone
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE/v1/media/${MKEY}")
test "$CODE" = "404" || test "$CODE" = "401"
ACK=$(curl -sf -X POST -H 'content-type: application/json' \
  -d "{\"wipeToken\":\"$WTOK\"}" \
  "$BASE/v1/admin/wipe/${WID}/ack")
echo "$ACK" | grep -q '"ok":true'
CMDS=$(curl -sf -H "$AUTH" "$BASE/v1/admin/wipe/commands")
echo "$CMDS" | grep -q "\"id\":\"$WID\""
# Peer session revoked
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH2" "$BASE/v1/me")
test "$CODE" = "401"
# Non-admin cannot wipe others (register third user)
H3="adminvictim$(date +%s)"
REG3=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H3\",\"password\":\"$PASS\",\"nickname\":\"Victim\",\"locale\":\"en\"}")
VICTIM=$(echo "$REG3" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
H4="adminbystander$(date +%s)"
REG4=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H4\",\"password\":\"$PASS\",\"nickname\":\"Bystander\",\"locale\":\"en\"}")
TOKEN4=$(echo "$REG4" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN4" \
  -H 'content-type: application/json' \
  -d "{\"userId\":\"$VICTIM\",\"reasonCode\":\"admin\"}" \
  "$BASE/v1/admin/wipe")
test "$CODE" = "403"
echo "ADMIN_REMOTE_WIPE_OK"
echo "ADMIN_WIPE_R2_OK"

echo "ADMIN_CONSOLE_OK"
