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
| `cuvs` | 和合本简体公版 (getbible `cus` → R2 whole-Bible) |
| `nasb` | NASB (boot; **licensed** — full text only via authorized R2 upload, not getbible) |
| `web` | World English Bible (downloadable whole-Bible) |
| `shinKyoudou` | 新共同訳 (downloadable) |

## Downloadable peers

| tid | Fixtures |
|-----|----------|
| `web`, `kjv`, `asv` | **PD dense key chapters** in-repo (26 refs via `fetch-pd-corpus-fixtures.mjs`). **Full Protestant canon** is seeded to R2 only (`seed-r2-pd-full.mjs`) — not committed to git. |
| `cuvt`, `kougo`, `rcuv`, `ccb`, `lzz`, `shinkaiyaku` | Same 7-ref teaching set (licensed samples; full text via R2 entitlement) |

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
| Boot (few) | `cuvs` (和合本), `nasb` | First launch installs **whole-Bible** pack into IndexedDB `lh-bible` |
| Download | `web`, `cuvt`, `shinKyoudou`, `kougo`, `kjv`, … | User taps **Download whole Bible** → same local DB (never per-chapter UX) |
| External | `esv`, `niv`, 恩道, 微读 | Deep link only |

Clients download whole-Bible packs (`scope=full`, optional `limit`/`after` transport paging) — never TypeScript densify, never chapter-by-chapter product installs.

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
