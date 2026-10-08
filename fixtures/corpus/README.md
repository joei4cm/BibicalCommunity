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

| tid | Fixtures |
|-----|----------|
| `web`, `kjv`, `asv` | **PD dense** — 26 key chapters with full verse text (`node scripts/fetch-pd-corpus-fixtures.mjs`) |
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
| Boot (few) | `cuvs`, `web`, `shinKyoudou` | First launch downloads pack into IndexedDB `lh-bible` |
| Download | `cuvt`, `kougo`, `kjv`, … | User taps Download → same local DB |
| External | `esv`, `niv`, 恩道, 微读 | Deep link only |

Licensed full corpora: place publisher-authorized JSON under this tree (or upload to R2 with entitlement); never commit unauthorized dumps.
