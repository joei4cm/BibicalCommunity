#!/usr/bin/env bash
# Study catalog (zh/en/ja) + Home post externalMediaUrl round-trip.
# Always registers a fresh user — parent smoke-home may have wiped TOKEN.
set -euo pipefail
BASE="${1:-${BASE:-http://127.0.0.1:8787}}"
PASS="${SMOKE_PASS:-SmokeTestPass123!}"

HANDLE="studysmoke$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"StudySmoke\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

echo "== bible study materials zh/en/ja =="
for LANG in zh en ja; do
  STUDY=$(curl -sf "$BASE/v1/bible/study?language=$LANG")
  echo "$STUDY" | head -c 200; echo
  echo "$STUDY" | grep -q '"materials":\['
  # Each language filter must return at least one material with that language tag.
  COUNT=$(printf '%s' "$STUDY" | grep -o "\"language\":\"$LANG\"" | wc -l | tr -d ' ')
  test "$COUNT" -ge 1
  echo "STUDY_${LANG}_OK count=$COUNT"
done
ALL=$(curl -sf "$BASE/v1/bible/study")
echo "$ALL" | grep -q '"materials":\['
echo "$ALL" | grep -q '"devotion":\['
echo "STUDY_CATALOG_OK"

echo "== home post with externalMediaUrl =="
SLUG="study-embed-$(date +%s)"
CHURCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"Study Embed Church\",\"slug\":\"$SLUG\",\"securityMode\":\"standard\"}" \
  "$BASE/v1/home/churches")
CHURCH_ID=$(echo "$CHURCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CHURCH_ID"

MEDIA_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
POST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"general\",\"title\":\"Embed smoke\",\"body\":\"See media\",\"externalMediaUrl\":\"$MEDIA_URL\"}" \
  "$BASE/v1/home/posts")
echo "$POST" | head -c 120; echo
echo "$POST" | grep -q '"id":"post_'
POST_ID=$(echo "$POST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

LIST=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=general")
echo "$LIST" | head -c 240; echo
echo "$LIST" | grep -q "$POST_ID"
echo "$LIST" | grep -q 'externalMediaUrl'
echo "$LIST" | grep -q "$MEDIA_URL"

# Schema-allowed generic embed URL also round-trips.
EMBED_URL="https://example.com/embed"
POST2=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"notice\",\"title\":\"Link embed\",\"body\":\"External link\",\"externalMediaUrl\":\"$EMBED_URL\"}" \
  "$BASE/v1/home/posts")
LIST2=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=notice")
echo "$LIST2" | grep -q "$EMBED_URL"
echo "HOME_EXTERNAL_MEDIA_OK"

echo "STUDY_EMBED_OK"
