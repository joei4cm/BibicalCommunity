#!/usr/bin/env bash
# Seed demo role accounts and assert org-tree visibility matrix.
# Roles: platform_admin, home admin, elder, deacon, coworker, group_leader, member.
set -euo pipefail
BASE="${1:-${BASE:-http://127.0.0.1:8787}}"
PASS="${SMOKE_PASS:-DemoRolePass123!}"
BOOTSTRAP_SECRET="${PLATFORM_ADMIN_BOOTSTRAP_SECRET:-dev-platform-admin-bootstrap}"
TS=$(date +%s)

reg() {
  local handle="$1" nick="$2"
  local reg
  reg=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
    -d "{\"handle\":\"$handle\",\"password\":\"$PASS\",\"nickname\":\"$nick\",\"locale\":\"zh-CN\"}")
  echo "$reg"
}

token_of() { echo "$1" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
uid_of() { echo "$1" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p'; }

echo "== register platform + role personas =="
R_PLAT=$(reg "demo_plat_$TS" "平台管理员")
TOK_PLAT=$(token_of "$R_PLAT"); UID_PLAT=$(uid_of "$R_PLAT")
test -n "$TOK_PLAT"

curl -sf -X POST -H "Authorization: Bearer $TOK_PLAT" -H 'content-type: application/json' \
  -d "{\"secret\":\"$BOOTSTRAP_SECRET\"}" \
  "$BASE/v1/admin/platform/bootstrap" >/dev/null
echo "PLATFORM_BOOTSTRAP_OK"

R_ADMIN=$(reg "demo_admin_$TS" "家管理员")
R_ELDER=$(reg "demo_elder_$TS" "长老")
R_DEACON=$(reg "demo_deacon_$TS" "执事")
R_COWORK=$(reg "demo_cowork_$TS" "同工")
R_GLEAD=$(reg "demo_glead_$TS" "小组长")
R_MEM_A=$(reg "demo_mem_a_$TS" "组员甲")
R_MEM_B=$(reg "demo_mem_b_$TS" "组员乙")
R_OUT=$(reg "demo_out_$TS" "外组员")

TOK_ADMIN=$(token_of "$R_ADMIN"); UID_ADMIN=$(uid_of "$R_ADMIN")
TOK_ELDER=$(token_of "$R_ELDER"); UID_ELDER=$(uid_of "$R_ELDER")
TOK_DEACON=$(token_of "$R_DEACON"); UID_DEACON=$(uid_of "$R_DEACON")
TOK_COWORK=$(token_of "$R_COWORK"); UID_COWORK=$(uid_of "$R_COWORK")
TOK_GLEAD=$(token_of "$R_GLEAD"); UID_GLEAD=$(uid_of "$R_GLEAD")
TOK_MEM_A=$(token_of "$R_MEM_A"); UID_MEM_A=$(uid_of "$R_MEM_A")
TOK_MEM_B=$(token_of "$R_MEM_B"); UID_MEM_B=$(uid_of "$R_MEM_B")
TOK_OUT=$(token_of "$R_OUT"); UID_OUT=$(uid_of "$R_OUT")

AUTH_PLAT="Authorization: Bearer $TOK_PLAT"
AUTH_ADMIN="Authorization: Bearer $TOK_ADMIN"

echo "== platform creates home =="
SLUG="demo-home-$TS"
CHURCH=$(curl -sf -X POST -H "$AUTH_PLAT" -H 'content-type: application/json' \
  -d "{\"name\":\"演示之家\",\"slug\":\"$SLUG\",\"securityMode\":\"standard\"}" \
  "$BASE/v1/home/churches")
CHURCH_ID=$(echo "$CHURCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CHURCH_ID"
echo "HOME_ID=$CHURCH_ID"

join() {
  local tok="$1"
  curl -sf -X POST -H "Authorization: Bearer $tok" -H 'content-type: application/json' \
    -d "{\"slug\":\"$SLUG\"}" "$BASE/v1/home/churches/join" >/dev/null
}

for tok in "$TOK_ADMIN" "$TOK_ELDER" "$TOK_DEACON" "$TOK_COWORK" "$TOK_GLEAD" "$TOK_MEM_A" "$TOK_MEM_B" "$TOK_OUT"; do
  join "$tok"
done

# Platform assigns admin role to home admin (creator already platform member as admin)
curl -sf -X POST -H "$AUTH_PLAT" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"userId\":\"$UID_ADMIN\",\"roles\":[\"admin\"]}" \
  "$BASE/v1/home/members/roles" >/dev/null

# Verify everyone via platform/admin
for uid in "$UID_ADMIN" "$UID_ELDER" "$UID_DEACON" "$UID_COWORK" "$UID_GLEAD" "$UID_MEM_A" "$UID_MEM_B" "$UID_OUT"; do
  curl -sf -X POST -H "$AUTH_PLAT" -H 'content-type: application/json' \
    -d "{\"churchId\":\"$CHURCH_ID\",\"userId\":\"$uid\"}" \
    "$BASE/v1/home/members/verify" >/dev/null
done

echo "== assign church roles =="
assign() {
  local uid="$1"; shift
  local roles_json="$1"
  curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
    -d "{\"churchId\":\"$CHURCH_ID\",\"userId\":\"$uid\",\"roles\":$roles_json}" \
    "$BASE/v1/home/members/roles" >/dev/null
}
assign "$UID_ELDER" '["elder"]'
assign "$UID_DEACON" '["deacon"]'
assign "$UID_COWORK" '["coworker"]'
assign "$UID_GLEAD" '["member"]'
assign "$UID_MEM_A" '["member"]'
assign "$UID_MEM_B" '["member"]'
assign "$UID_OUT" '["member"]'

echo "== create department + small group =="
DEPT=$(curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"name\":\"敬拜部\",\"kind\":\"department\"}" \
  "$BASE/v1/home/groups")
DEPT_ID=$(echo "$DEPT" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$DEPT_ID"

GRP=$(curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"name\":\"青成一组\",\"kind\":\"small_group\",\"parentId\":\"$DEPT_ID\"}" \
  "$BASE/v1/home/groups")
GRP_ID=$(echo "$GRP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$GRP_ID"

# Put coworker on department; glead as leader of group; mem A/B in group; out elsewhere
curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_COWORK\",\"role\":\"member\"}" \
  "$BASE/v1/home/groups/${DEPT_ID}/members" >/dev/null

curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_GLEAD\",\"role\":\"leader\"}" \
  "$BASE/v1/home/groups/${GRP_ID}/members" >/dev/null

curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_MEM_A\",\"role\":\"member\"}" \
  "$BASE/v1/home/groups/${GRP_ID}/members" >/dev/null

curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_MEM_B\",\"role\":\"member\"}" \
  "$BASE/v1/home/groups/${GRP_ID}/members" >/dev/null

# Outer member alone in another group
GRP2=$(curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"name\":\"外组\",\"kind\":\"small_group\"}" \
  "$BASE/v1/home/groups")
GRP2_ID=$(echo "$GRP2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -sf -X POST -H "$AUTH_ADMIN" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_OUT\",\"role\":\"member\"}" \
  "$BASE/v1/home/groups/${GRP2_ID}/members" >/dev/null

tree_has() {
  local tok="$1" needle="$2"
  local tree
  tree=$(curl -sf -H "Authorization: Bearer $tok" "$BASE/v1/home/${CHURCH_ID}/org-tree")
  echo "$tree" | grep -q "$needle"
}

tree_lacks() {
  local tok="$1" needle="$2"
  local tree
  tree=$(curl -sf -H "Authorization: Bearer $tok" "$BASE/v1/home/${CHURCH_ID}/org-tree")
  ! echo "$tree" | grep -q "$needle"
}

echo "== visibility matrix =="
# Elder sees whole church (including outer)
tree_has "$TOK_ELDER" "$UID_OUT"
tree_has "$TOK_ELDER" "$UID_MEM_A"
echo "ELDER_SEES_CHURCH_OK"

# Deacon sees whole church
tree_has "$TOK_DEACON" "$UID_OUT"
echo "DEACON_SEES_CHURCH_OK"

# Group leader sees church (policy: group leaders see church directory)
tree_has "$TOK_GLEAD" "$UID_OUT"
echo "GROUP_LEADER_SEES_CHURCH_OK"

# Ordinary group member sees peers + leaders, not outer-only member
tree_has "$TOK_MEM_A" "$UID_MEM_B"
tree_has "$TOK_MEM_A" "$UID_GLEAD"
tree_has "$TOK_MEM_A" "$UID_ELDER"
tree_lacks "$TOK_MEM_A" "$UID_OUT"
echo "MEMBER_PEER_AND_LEADERS_OK"

# Coworker sees department subtree (mem A under dept) — at least mem A
tree_has "$TOK_COWORK" "$UID_MEM_A"
echo "COWORKER_DEPT_OK"

# Non-admin cannot create group
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOK_MEM_A" \
  -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"name\":\"拒绝创建\"}" \
  "$BASE/v1/home/groups")
test "$CODE" = "403"
echo "MEMBER_CREATE_GROUP_FORBIDDEN_OK"

# Non-leader cannot add group members
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOK_MEM_A" \
  -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_OUT\",\"role\":\"member\"}" \
  "$BASE/v1/home/groups/${GRP_ID}/members")
test "$CODE" = "403"
echo "MEMBER_ADD_GROUP_FORBIDDEN_OK"

# Group leader can add outer into their group
curl -sf -X POST -H "Authorization: Bearer $TOK_GLEAD" -H 'content-type: application/json' \
  -d "{\"userId\":\"$UID_OUT\",\"role\":\"member\"}" \
  "$BASE/v1/home/groups/${GRP_ID}/members" >/dev/null
echo "GROUP_LEADER_ADD_OK"

# Non-platform cannot create home
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOK_ADMIN" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"应拒绝\",\"slug\":\"nope-$TS\"}" \
  "$BASE/v1/home/churches")
test "$CODE" = "403"
echo "HOME_ADMIN_CREATE_HOME_FORBIDDEN_OK"

echo
echo "DEMO_ACCOUNTS (password=$PASS)"
echo "  platform: demo_plat_$TS"
echo "  home_admin: demo_admin_$TS"
echo "  elder: demo_elder_$TS"
echo "  deacon: demo_deacon_$TS"
echo "  coworker: demo_cowork_$TS"
echo "  group_leader: demo_glead_$TS"
echo "  member_a: demo_mem_a_$TS"
echo "  member_b: demo_mem_b_$TS"
echo "  outer: demo_out_$TS"
echo "  home_slug: $SLUG"
echo "ORG_ROLES_SMOKE_OK"
