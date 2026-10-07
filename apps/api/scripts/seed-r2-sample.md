# Seed sample CUVS John.1 into R2 (MEDIA)

Licensed translations (e.g. `cuvs`) load from the Worker `MEDIA` R2 binding at:

```
bible/{translationId}/{book}.{chapter}.json
```

Chapter JSON shape (see `@logoshome/bible` `r2-format.ts`):

```json
{
  "book": "John",
  "chapter": 1,
  "verses": [{ "verse": 1, "text": "…" }]
}
```

## Via media API (auth required)

```bash
BASE=http://127.0.0.1:8787
AUTH="Authorization: Bearer $TOKEN"

# Write sample chapter (key may be any path; bible chapters use the convention below)
curl -sS -X PUT "$BASE/v1/media/put/bible/cuvs/John.1.json" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{
    "book": "John",
    "chapter": 1,
    "verses": [
      { "verse": 1, "text": "太初有道，道与神同在，道就是神。" },
      { "verse": 2, "text": "这道太初与神同在。" },
      { "verse": 14, "text": "道成了肉身，住在我们中间，充充满满地有恩典有真理。" }
    ]
  }'

# Optional: grant entitlement (required when ENVIRONMENT != development)
curl -sS -X POST "$BASE/v1/bible/entitlements" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d '{"translationId":"cuvs"}'

# Load chapter
curl -sS "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1" -H "$AUTH"
```

In local `ENVIRONMENT=development`, entitlement checks are bypassed for licensed R2 packs.
