# Corpus fixtures (JSON data — not TypeScript)

Drop Bible chapter JSON here to seed R2 / client local DB. **Do not** densify full corpora into `packages/bible/src/packs/*.ts`.

## Layout

```
fixtures/corpus/{translationId}/{Book}.{chapter}.json
```

Examples:

- `cuvs/John.1.json` — boot default (和合本简体)
- `web/Ps.23.json` — boot default (WEB)
- `shinKyoudou/John.3.json` — boot default (新共同訳)
- `kougo/John.1.json` — downloadable sample
- `cuvt` / `rcuv` / `ccb` / `lzz` / `shinkaiyaku` — downloadable peer demos
- `kjv` / `asv` — public-domain English downloadable fixtures

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
# Offline → LocalCorpusDb
bash scripts/smoke-corpus-json-import.sh

# Live API → R2
# (registers a temp user, then)
node scripts/seed-r2-from-json-fixtures.mjs http://127.0.0.1:8787 "$TOKEN"
```

## Product model

| Mode | translationId examples | How text arrives |
|------|------------------------|------------------|
| Boot (few) | `cuvs`, `web`, `shinKyoudou` | First launch downloads pack into IndexedDB `lh-bible` |
| Download | `cuvt`, `kougo`, `rcuv`, … | User taps Download → same local DB |
| External | `esv`, `niv`, 恩道, 微读 | Deep link only |

Licensed full corpora: place publisher-authorized JSON under this tree (or upload to R2 with entitlement); never commit unauthorized dumps.
