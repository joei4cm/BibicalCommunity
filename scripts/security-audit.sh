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
if rg -n 'allowed = \[' apps/api/src/durable/CallRoomDO.ts | grep -q .; then
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
