# Corpus fixtures (JSON data — not TypeScript)

Drop Bible chapter JSON here to seed R2 / client local DB. **`packages/bible/src/packs/` must not exist** — never densify corpora into TypeScript.

## Layout

```
fixtures/corpus/{translationId}/{Book}.{chapter}.json
```

## Boot teaching set (parity required)

All three boot tids must include:

`John.1`, `John.3`, `John.14`, `Ps.23`, `Rom.8`, `Matt.5`, `Gen.1`

| tid | Role |
|-----|------|
| `cuvs` | 和合本简体 (boot) |
| `web` | World English Bible (boot) |
| `shinKyoudou` | 新共同訳 (boot) |

## Downloadable peers

| tid | Teaching-set fixtures |
|-----|----------------------|
| `kjv`, `asv`, `cuvt`, `kougo` | Same 7-ref teaching set |
| `rcuv`, `ccb`, `lzz`, `shinkaiyaku` | Slim samples (`John.1`, `Ps.23`, …) |

## Chapter JSON shape

Same as R2 object body (`bible/{tid}/{Book}.{N}.json`):

```json
{
  "book": "John",
  "chapter": 1,
  "verses": [{ "verse": 1, "text": "…" }]
}
```

## Import

```bash
# Offline → LocalCorpusDb (+ CORPUS_BOOT_TEACHING_PARITY_OK)
bash scripts/smoke-corpus-json-import.sh

# Live API → R2
node scripts/seed-r2-from-json-fixtures.mjs http://127.0.0.1:8787 "$TOKEN"
```

## Product model

| Mode | translationId examples | How text arrives |
|------|------------------------|------------------|
| Boot (few) | `cuvs`, `web`, `shinKyoudou` | First launch downloads pack into IndexedDB `lh-bible` |
| Download | `cuvt`, `kougo`, `kjv`, … | User taps Download → same local DB |
| External | `esv`, `niv`, 恩道, 微读 | Deep link only |

**Full public-domain canon** (WEB / KJV / ASV) is **not** stored in git or TypeScript. Platform admins seed it into R2:

```bash
# One book (Workers-safe) or loop 1..66
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"tid":"web","bookNr":43}' http://127.0.0.1:8787/v1/admin/corpus/pd-seed

# Or CLI (requires platform_admin token)
node scripts/seed-r2-pd-full.mjs http://127.0.0.1:8787 "$TOKEN" web
bash scripts/smoke-admin-pd-corpus.sh
```

Licensed full corpora: place publisher-authorized JSON under this tree (or upload to R2 with entitlement); never commit unauthorized dumps.
