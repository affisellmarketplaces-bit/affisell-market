# Radar — Multi-country crawl (DX)

Avoid bare `curl $URL/...` when `URL` is empty (`URL rejected: No host part`).

## Local

```bash
# Dev server on 3001 (Affisell default) — loads CRON_SECRET from .env.local
npm run radar:crawl -- FR,US,MX

# Explicit base URL
URL=http://localhost:3001 npm run radar:crawl -- FR,US,MX
```

## Production

```bash
npm run radar:crawl:prod -- FR,US,MX
# ≡ URL=https://www.affisell.com tsx scripts/radar-crawl.ts FR,US,MX
```

## Env

| Variable | Required | Notes |
|----------|----------|--------|
| `CRON_SECRET` | yes | Bearer / `x-cron-secret` |
| `URL` or `NEXT_PUBLIC_APP_URL` | yes* | Script defaults to `http://localhost:3001` if unset |
| `RADAR_COUNTRIES` | no | Default countries when query omitted (server) |

\* Prefer setting `URL` explicitly when not using the npm script.

## Manual curl (if needed)

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  -H "x-cron-secret: $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/radar/cron/global-scan?countries=FR,US,MX" | jq .
```

## Admin UI

`/admin/radar` → **Multi-Country Crawl** → Trigger FR/US/MX (session ADMIN, no secret in browser).

## Response shape

```json
{
  "started": true,
  "url": "http://localhost:3001",
  "countries": ["FR", "US", "MX"],
  "jobs": [{ "country": "FR", "snapshots": 12, "products": 12, "errors": [] }],
  "message": "Crawl launched, check /admin/radar in 30s"
}
```
