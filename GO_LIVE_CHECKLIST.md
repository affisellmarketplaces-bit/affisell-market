# GO-LIVE CHECKLIST — World Radar (prod Neon)

**Ne pas lancer le seed depuis un agent CI sans confirmation humaine.**

---

## 0. Prérequis

- [ ] Deploy Vercel `main` vert (commits `9a2425917` + go-live scripts)
- [ ] `.env.local` contient `DATABASE_URL_UNPOOLED` (Neon **direct**, pas pooler)
- [ ] Tables Radar: `RadarCountry`, `RadarWinner`, `RadarTrendingKeyword` dans schema `market_intelli`

---

## 1. Push schema Radar (1× si pas déjà fait)

```bash
npm run radar:db:push
```

Équivalent interne: `node scripts/radar-db.mjs push` → Neon + `prisma/radar.schema.prisma`.

---

## 2. Seed PROD (interactif — tape `PROD`)

**Recommandé (safe):**

```bash
npm run radar:seed:prod
```

Le script `scripts/seed-prod-safe.mjs` :
1. Affiche le host Neon masqué (`ep-…`)
2. Demande de taper `PROD`
3. Refuse localhost / non-`neon.tech`
4. Lance `npm run radar:seed:world` (FR, DE, US, UK, JP, BR, MA)

**Alternatif manuel:**

```bash
# Commande prod à lancer en local:
DATABASE_URL_UNPOOLED=$(grep DATABASE_URL_UNPOOLED .env.local | cut -d '=' -f2-) npm run radar:seed:world
```

Attendu en fin de seed:

```
[WORLD] Seeded FR: 20 winners
…
[PROD] ✅ FR: 20 winners
[PROD] ✅ DE: 20 winners
…
Va vérifier: https://affisell.com/api/radar?country=FR doit retourner 20
```

---

## 3. Vérifs live (session Pro / Global)

| URL | Attendu |
|-----|---------|
| https://affisell.com/ | Section World Radar Terminal au-dessus Producteur/Grossiste |
| https://affisell.com/radar?country=FR | Terminal + 20 winners + moats |
| https://affisell.com/api/radar?country=FR | JSON `winners.length === 20` (auth cookie) |
| https://affisell.com/api/radar/countries | `total >= 30`, `byRegion` |
| https://affisell.com/radar/winners | Paywall si free, liste si Pro |

```bash
# Exemple (cookie session browser exporté)
curl -sS -H "Cookie: …" "https://affisell.com/api/radar?country=FR" | jq '.winners|length,.source'
```

---

## 4. Cache / coût

| Couche | TTL |
|--------|-----|
| DB `RadarWinner.expiresAt` | 6h |
| Cron `/api/cron/radar-scan` | toutes les 6h (5 pays/run) |
| API `revalidate` | **21600s (6h)** |
| Response `Cache-Control` | `private, max-age=60, stale-while-revalidate=21600` |
| Client SWR | `dedupingInterval: 3600_000` |

Pas de `force-dynamic` + `no-store` sur `/api/radar` / `/api/radar/countries`.

---

## 5. Cron prod

- [ ] Vercel cron `GET /api/cron/radar-scan` schedule `0 */6 * * *`
- [ ] `CRON_SECRET` set sur Vercel Production
- [ ] Smoke (optionnel):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://affisell.com/api/cron/radar-scan?countries=FR"
```

---

## 6. Rollback mental

Si seed foire: l’API retombe en **mock** (20 winners) — pas de 500.  
Si tables absentes: `npm run radar:db:push` puis `npm run radar:seed:prod`.

---

## Scripts package.json

| Script | Rôle |
|--------|------|
| `npm run radar:db:push` | Push `prisma/radar.schema.prisma` |
| `npm run radar:seed:world` | Seed 7 pays (idempotent) |
| `npm run radar:seed:prod` | Wrapper safe + confirmation `PROD` |

---

## Sign-off

- [ ] Seed prod exécuté manuellement
- [ ] `/api/radar?country=FR` → 20
- [ ] Landing World teaser visible
- [ ] Moats visibles (Arbitrage / Saturation / Supplier Match)
