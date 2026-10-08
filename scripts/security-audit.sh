#!/usr/bin/env bash
# Lightweight static checks against docs/SECURITY.md hard rules.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0

echo "== LogosHome security audit (static) =="

check_absent() {
  local pattern="$1"
  local label="$2"
  if rg -n --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/*.md' -e "$pattern" apps packages 2>/dev/null | head -5 | grep -q .; then
    echo "FAIL: $label"
    rg -n --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/*.md' -e "$pattern" apps packages 2>/dev/null | head -8 || true
    fail=1
  else
    echo "OK: $label"
  fi
}

# Push payloads should not interpolate message plaintext fields in API responses for notifications
check_absent 'pushNotification.*ciphertext|preview:.*plaintext' "no plaintext push preview wiring"

# Recovery mnemonics must not be POSTed to server as plaintext field names in API
check_absent 'mnemonic|recoveryPhrase' "no recovery mnemonic server fields (scan)"

# Ensure CallRoom does not accept arbitrary types that could smuggle media
if rg -n 'isCallSignalType|CALL_SIGNAL_TYPES' apps/api/src/durable/CallRoomDO.ts packages/shared/src/call-signaling.ts | grep -q .; then
  echo "OK: CallRoom allowlist present"
else
  echo "FAIL: CallRoom signaling allowlist missing"
  fail=1
fi

# Wipe must tombstone ciphertext
if rg -n 'tombstoned|ciphertext' apps/api/src/routes/admin.ts | grep -q .; then
  echo "OK: wipe path references tombstone/ciphertext"
else
  echo "FAIL: wipe path missing tombstone handling"
  fail=1
fi

# Wipe must delete R2 user media (SECURITY.md §7)
if rg -n 'deleteUserMediaObjects|r2Deleted' apps/api/src/routes/admin.ts apps/api/src/services/wipe-media.ts | grep -q .; then
  echo "OK: wipe path deletes R2 media objects"
else
  echo "FAIL: wipe path missing R2 media deletion"
  fail=1
fi

# Wipe must zero annotation ciphertext
if rg -n 'schema\.annotations' apps/api/src/routes/admin.ts | grep -q . \
  && rg -n 'ciphertext: ""' apps/api/src/routes/admin.ts | grep -q .; then
  echo "OK: wipe path zeros annotation ciphertext"
else
  echo "FAIL: wipe path missing annotation ciphertext zeroing"
  fail=1
fi

# Cron must expire stale wipe commands
if rg -n "wipe_commands.*expired|status = 'expired'" apps/api/src/index.ts | grep -q .; then
  echo "OK: cron expires pending wipe commands"
else
  echo "FAIL: cron missing wipe command expiry"
  fail=1
fi

# Field crypto present for profile
if test -f apps/api/src/services/field-crypto.ts; then
  echo "OK: field-crypto service exists"
else
  echo "FAIL: field-crypto missing"
  fail=1
fi

# E2EE packages present
for f in packages/crypto/src/x3dh.ts packages/crypto/src/double-ratchet.ts packages/crypto/src/wipe.ts; do
  if test -f "$f"; then echo "OK: $f"; else echo "FAIL: missing $f"; fail=1; fi
done

# Docs present
for f in docs/SECURITY.md docs/DEPLOY.md docs/ARCHITECTURE.md; do
  if test -f "$f"; then echo "OK: $f"; else echo "FAIL: missing $f"; fail=1; fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "AUDIT_FAIL"
  exit 1
fi
echo "AUDIT_OK"
