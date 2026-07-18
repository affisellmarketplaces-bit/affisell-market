# Affisell Analytics Connector — TikTok Shop

App Partner : **Affisell Analytics Connector**  
Redirect URI (prod) : `https://affisell.com/api/intelli/tiktok/callback`  
Webhook URI (prod) : `https://affisell.com/api/webhooks/tiktok`

## Architecture

| Surface | Path |
|---------|------|
| OAuth start | `GET /api/intelli/tiktok/start` (alias `/api/radar/tiktok/start`) |
| OAuth callback | `GET /api/intelli/tiktok/callback` (**no 301** — exact Partner URI) |
| Webhook | `POST /api/webhooks/tiktok` (+ alias `/api/radar/webhooks/tiktok`) |
| Token refresh cron | `GET /api/cron/tiktok-refresh` (daily 06:00 UTC) |
| Client | `lib/tiktok/client.ts` |
| Processor | `lib/tiktok/webhook-processor.ts` |
| Storage | Prisma `ShopConnection` + `TikTokOrder` + `TikTokWebhookLog` (`market_intelli`) |

Tokens at rest : AES-256-GCM via `ENCRYPTION_KEY` (alias `TIKTOK_TOKEN_ENCRYPTION_KEY`).

## Env (Vercel + `.env.local`)

```bash
RADAR_ENABLED=true
REDIS_URL=rediss://…
ENCRYPTION_KEY=<64 hex>
CRON_SECRET=<64 hex>

TIKTOK_SHOP_APP_KEY=<App Key Partner Center>
TIKTOK_SHOP_APP_SECRET=<App Secret>
TIKTOK_SHOP_APP_ID=<App ID / service_id>
TIKTOK_SHOP_REDIRECT_URI=https://affisell.com/api/intelli/tiktok/callback
```

Legacy aliases still work : `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`.

Après schema :

```bash
npm run radar:db:push
```

## Flow OAuth

1. User → `/radar/connect` → **Connecter TikTok Shop** → `/api/intelli/tiktok/start`
2. State CSRF stocké Redis (`radar:oauth:state:*`, TTL 600s)
3. Redirect Partner : `https://services.tiktokshop.com/open/authorize?service_id={APP_ID}&state=…`
4. Callback → `exchangeAuthCode` (`grant_type=authorized_code`) → chiffrement tokens → `ShopConnection`
5. Redirect `/radar?connected=1&success=tiktok_connected&shop_id=…`

## Webhooks (types 1–6)

Réponse **toujours** rapide :

```json
{ "code": 0, "message": "success" }
```

Signature : headers `X-TT-Signature` ou `x-tiktok-shop-signature` (HMAC-SHA256, secret app).

Traitement async (`after()`):

| Type | Action |
|------|--------|
| 1–4 | Sync order → `TikTokOrder` |
| 5 | Invalidate cache produit (touch `ShopConnection`) |
| 6 | `status=disconnected` |

Logs : `TikTokWebhookLog` + `WebhookEvent` (idempotent).

### Test webhook local (ngrok)

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3001
# → https://xxxx.ngrok.app

# Point temporairement Partner Center webhook vers:
# https://xxxx.ngrok.app/api/webhooks/tiktok
```

Simuler un ACK (signature skip en local seulement si tu mocks — en prod signature requise) :

```bash
# Avec signature réelle (exemple structure — calcule HMAC côté script)
curl -s -X POST "$NGROK/api/webhooks/tiktok" \
  -H "content-type: application/json" \
  -H "x-tt-signature: t=$(date +%s),v1=DEADBEEF" \
  -d '{"type":1,"shop_id":"demo","data":{"order_id":"ORD1"}}'
```

Pour un test de signature valide en Node :

```bash
node -e '
const crypto=require("crypto");
const secret=process.env.TIKTOK_SHOP_APP_SECRET;
const body=JSON.stringify({type:1,shop_id:"s1",data:{order_id:"o1"}});
const t=Math.floor(Date.now()/1000);
const v1=crypto.createHmac("sha256",secret).update(`${t}.${body}`).digest("hex");
console.log(`t=${t},v1=${v1}`);
console.log(body);
'
```

Puis :

```bash
curl -s -X POST "http://localhost:3001/api/webhooks/tiktok" \
  -H "content-type: application/json" \
  -H "x-tt-signature: $SIG" \
  -d "$BODY"
# → {"code":0,"message":"success"}
```

## Cron refresh

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "$APP/api/cron/tiktok-refresh"
# → { scanned, refreshed, failed, disconnected }
```

Vercel Cron : `0 6 * * *` → `/api/cron/tiktok-refresh` (`vercel.json`).

## Checklist go-live (après validation Partner)

1. `RADAR_ENABLED=true` + `ENCRYPTION_KEY` + `REDIS_URL` sur Vercel  
2. `TIKTOK_SHOP_APP_KEY` / `_SECRET` / `_APP_ID` / `_REDIRECT_URI`  
3. `npm run radar:db:push`  
4. Connecter un shop sandbox/prod via `/radar/connect`  
5. Vérifier webhook Partner → 200 `{code:0}`  
6. Cron refresh OK  

**Ne pas modifier** IP allowlist / webhook URI déjà configurés dans Partner Center (sauf ngrok temporaire en local).
