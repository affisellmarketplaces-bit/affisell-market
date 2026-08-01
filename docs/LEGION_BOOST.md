# LÉGION BOOST (Week 2)

Temporary affiliate commission spike (35–50%) for **2 hours**, broadcast to the Légion army via the public storefront banner.

Runtime stack: **Prisma / Neon + NextAuth** (same as Week 1). Spec SQL lives in `supabase/migrations/20250710_boost.sql`.

## Integration

### Storefront (`StoreTemplate`)

`BoostBanner` is mounted under the sticky header in `components/store/StoreTemplate.tsx`.

- Polls `GET /api/legion/boost/active` every 30s
- Shows the soonest-ending active boost (Battle Royale `#d4ff00`)
- CTA → `/product/{id}?boost={boostId}`

### Supplier dashboard

`BoostButton` is on `/dashboard/supplier/products/[id]` (published products only).

```tsx
import { BoostButton } from "@/components/supplier/BoostButton"

<BoostButton
  productId={product.id}
  productTitle={product.name}
  currentArmySize={armySize} // active StoreProfile count
/>
```

Footer of the button shows SIRET `99119663500015`.

## APIs

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/legion/boost` | Supplier session (NextAuth). Body `supplier_id` only allowed outside production. |
| GET | `/api/legion/boost/active` | Public |
| GET | `/api/cron/boost-expire` | `Authorization: Bearer ${CRON_SECRET}` |

Cron: `vercel.json` → `*/1 * * * *` → `/api/cron/boost-expire` (calls SQL `expire_boosts()`).

## Test (curl)

```bash
npx prisma migrate deploy

# Active boosts (public)
curl -s 'http://localhost:3001/api/legion/boost/active' | jq .

# Create boost (logged-in supplier cookie, or local fallback)
curl -s -X POST 'http://localhost:3001/api/legion/boost' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: ...' \
  -d '{"product_id":"<PRODUCT_ID>","product_title":"Demo","boost_margin_rate":0.40}'

# Expire cron
curl -s 'http://localhost:3001/api/cron/boost-expire' \
  -H "Authorization: Bearer $CRON_SECRET"

# Vitrine
open 'http://localhost:3001/nelson'
```

## Files

- `supabase/migrations/20250710_boost.sql`
- `prisma/migrations/20260801200000_legion_boost_week2/`
- `lib/legion/boost.ts` · `lib/legion/expire-boosts.ts`
- `app/api/legion/boost/route.ts` · `active/route.ts`
- `app/api/cron/boost-expire/route.ts`
- `components/store/BoostBanner.tsx` · `components/supplier/BoostButton.tsx`
