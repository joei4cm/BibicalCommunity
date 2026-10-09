#!/usr/bin/env bash
# Deploy API Worker on a wrangler temporary preview account (no production CF token).
# Preview accounts cannot create R2 — uses wrangler.temporary.toml (MEDIA omitted).
# Flow: mint/reuse preview account → create D1 → sqlite DO migration → migrate → deploy → /health.
#
# Tokens:
#   LIVE_WORKERS_TEMPORARY_OK — Worker live (health 200); auth may still hit preview bot challenge
#   CORPUS_LIVE_R2_OPEN — still OPEN (no R2 on preview)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"

CFG="wrangler.temporary.toml"
ACCOUNT_TOML="${HOME}/.config/.wrangler/wrangler-temporary-account.toml"

echo "== temporary Workers deploy (no R2) =="

# Unset production auth so --temporary can mint/reuse a preview account.
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID || true

if [[ ! -f "$ACCOUNT_TOML" ]]; then
  # First attempt writes account toml even if D1/DO config is wrong.
  npx wrangler deploy --temporary -c "$CFG" >/tmp/wrangler-temp-bootstrap.log 2>&1 || true
fi

if [[ ! -f "$ACCOUNT_TOML" ]]; then
  echo "LIVE_WORKERS_TEMPORARY_OPEN reason=no_temporary_account"
  echo "CORPUS_LIVE_R2_OPEN reason=preview_cannot_create_r2"
  exit 0
fi

API_TOKEN="$(python3 -c 'import re,sys; t=open(sys.argv[1]).read(); m=re.search(r"apiToken\s*=\s*\"([^\"]+)\"", t); print(m.group(1) if m else "")' "$ACCOUNT_TOML")"
ACCOUNT_ID="$(python3 -c 'import re,sys; t=open(sys.argv[1]).read(); m=re.search(r"^id\s*=\s*\"([^\"]+)\"", t, re.M); print(m.group(1) if m else "")' "$ACCOUNT_TOML")"

if [[ -z "$API_TOKEN" || -z "$ACCOUNT_ID" ]]; then
  echo "LIVE_WORKERS_TEMPORARY_OPEN reason=temporary_account_unreadable"
  echo "CORPUS_LIVE_R2_OPEN reason=preview_cannot_create_r2"
  exit 0
fi

# Authenticated deploy against the preview account (cannot combine with --temporary).
export CLOUDFLARE_API_TOKEN="$API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

EXISTING_ID="$(python3 -c 'import re,sys; t=open(sys.argv[1]).read(); m=re.search(r"database_id\s*=\s*\"([^\"]+)\"", t); print(m.group(1) if m else "")' "$CFG")"

DB_ID=""
if [[ -n "$EXISTING_ID" && "$EXISTING_ID" != "00000000-0000-0000-0000-000000000001" ]]; then
  if npx wrangler d1 info logoshome -c "$CFG" >/tmp/d1-info.log 2>&1; then
    DB_ID="$EXISTING_ID"
  fi
fi

if [[ -z "$DB_ID" ]]; then
  CREATE_OUT="$(npx wrangler d1 create logoshome -c "$CFG" 2>&1 | tee /tmp/d1-create-temp.log || true)"
  DB_ID="$(printf '%s\n' "$CREATE_OUT" | python3 -c 'import sys,re; t=sys.stdin.read(); m=re.search(r"database_id\s*=\s*\"([^\"]+)\"", t); print(m.group(1) if m else "")')"
  if [[ -z "$DB_ID" ]]; then
    LIST_OUT="$(npx wrangler d1 list -c "$CFG" 2>&1 | tee /tmp/d1-list-temp.log)"
    DB_ID="$(printf '%s\n' "$LIST_OUT" | python3 -c '
import sys,re
for line in sys.stdin:
  if "logoshome" in line.lower():
    m=re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", line, re.I)
    if m:
      print(m.group(0))
      break
')"
  fi
fi

if [[ -z "$DB_ID" ]]; then
  echo "LIVE_WORKERS_TEMPORARY_OPEN reason=d1_create_failed"
  echo "CORPUS_LIVE_R2_OPEN reason=preview_cannot_create_r2"
  exit 0
fi

python3 -c '
import re,sys
path, db_id = sys.argv[1], sys.argv[2]
text = open(path).read()
text2, n = re.subn(r"(database_id\s*=\s*\")[^\"]+(\")", rf"\g<1>{db_id}\2", text, count=1)
if n != 1:
  raise SystemExit("failed to patch database_id")
open(path, "w").write(text2)
print(f"patched {path} database_id={db_id}")
' "$CFG" "$DB_ID"

echo "== apply D1 migrations (remote) =="
npx wrangler d1 migrations apply logoshome --remote -c "$CFG" 2>&1 | tee /tmp/d1-migrate-temp.log

echo "== deploy Worker (preview account, authenticated) =="
if ! npx wrangler deploy -c "$CFG" 2>&1 | tee /tmp/wrangler-temp-deploy-live.log; then
  tail -40 /tmp/wrangler-temp-deploy-live.log
  echo "LIVE_WORKERS_TEMPORARY_OPEN reason=deploy_failed"
  echo "CORPUS_LIVE_R2_OPEN reason=preview_cannot_create_r2"
  exit 0
fi

WORKER_URL="$(python3 -c '
import re
t=open("/tmp/wrangler-temp-deploy-live.log").read()
m=re.search(r"https://[a-zA-Z0-9._/-]+\.workers\.dev", t)
print(m.group(0) if m else "")
')"

if [[ -z "$WORKER_URL" ]]; then
  tail -50 /tmp/wrangler-temp-deploy-live.log
  echo "LIVE_WORKERS_TEMPORARY_OPEN reason=no_worker_url"
  echo "CORPUS_LIVE_R2_OPEN reason=preview_cannot_create_r2"
  exit 0
fi

echo "WORKER_URL=$WORKER_URL"
sleep 2
HTTP="$(curl -s -o /tmp/temp-health.body -w '%{http_code}' "$WORKER_URL/health" || echo 000)"
echo "health_http=$HTTP body=$(head -c 200 /tmp/temp-health.body 2>/dev/null || true)"
CORPUS_HTTP="$(curl -s -o /tmp/temp-corpus.body -w '%{http_code}' "$WORKER_URL/v1/bible/corpus-download/cuvs?scope=boot&limit=1" || echo 000)"
echo "corpus_http=$CORPUS_HTTP"

if [[ "$HTTP" == "200" ]]; then
  echo "LIVE_WORKERS_TEMPORARY_OK url=$WORKER_URL health=200 corpus_http=$CORPUS_HTTP media=optional"
  # Best-effort D1 boot corpus seed (may hit preview bot challenge on /auth).
  LIVE_API_BASE="$WORKER_URL" bash "$ROOT/scripts/seed-d1-corpus-boot.sh" "$WORKER_URL" \
    | tee /tmp/d1-corpus-seed-temp.log || true
else
  echo "LIVE_WORKERS_TEMPORARY_OPEN reason=health_failed http=$HTTP url=$WORKER_URL"
fi

echo "CORPUS_LIVE_R2_OPEN reason=preview_cannot_create_r2 need=production_CF_token"
echo "LIVE_API_BASE=$WORKER_URL"
