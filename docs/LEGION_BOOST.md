# LÉGION BOOST + Leaderboard (Week 2–3)

Temporary affiliate commission spike (35–50%) for **2 hours**, army banner, and **real-time Battle leaderboard**.

Runtime stack: **Prisma / Neon + NextAuth**. Spec SQL:
- `supabase/migrations/20250710_boost.sql`
- `supabase/migrations/20250711_leaderboard.sql`

## Integration

### Storefront (`StoreTemplate`)

`BoostBanner` + `LeaderboardLegion` under the sticky header.

- Banner polls `GET /api/legion/boost/active` every 30s
- Leaderboard polls `GET /api/legion/leaderboard` every 10s
- CTA → `/product/{id}?boost={boostId}`

### Supplier dashboard

`BoostButton` + `LeaderboardLegion` on `/dashboard/supplier/products/[id]` (published products).

```tsx
import { BoostButton } from "@/components/supplier/BoostButton"
import { LeaderboardLegion } from "@/components/store/LeaderboardLegion"

<BoostButton productId={product.id} productTitle={product.name} currentArmySize={armySize} />
<LeaderboardLegion productId={product.id} />
```

Footer shows SIRET `99119663500015`.

## APIs

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/legion/boost` | Supplier session |
| GET | `/api/legion/boost/active` | Public |
| GET | `/api/legion/leaderboard` | Public (`boost_id`, `product_id` optional) |
| GET | `/api/cron/boost-expire` | `Authorization: Bearer ${CRON_SECRET}` |

## Leaderboard semantics

- Window: `Order.paidAt` between boost `startsAt`–`endsAt`
- Attribution: `Order.storeProfileId` → `StoreProfile`
- Excludes `payoutStatus = FAILED` and `status = refunded`
- Prefers SQL view `legion_leaderboard`; Prisma aggregation fallback if view missing (`fallback: true`)

## Test

```bash
curl -s 'http://localhost:3001/api/legion/leaderboard' | jq .
curl -s 'http://localhost:3001/api/legion/leaderboard?product_id=PRODUCT_ID' | jq .
```
