# Stripe — Affisell Radar Global ($99)

## Bootstrap 1-clic (recommandé)

```bash
npm run stripe:ensure-radar
```

Crée (idempotent) les produits + prices Stripe :
- Pro $49/mois — `lookup_key=affisell_radar_pro_monthly`
- Global $99/mois — `lookup_key=affisell_radar_global_monthly`

Écrit `STRIPE_RADAR_PRO_PRICE_ID` + `STRIPE_RADAR_GLOBAL_PRICE_ID` dans `.env.local`.

Sans env (ou avec un **price ID stale** d’un autre compte Stripe), le checkout  
**valide** l’ID puis auto-provisionne via lookup_key — plus d’erreur  
`No such price: 'price_…'`. Si Stripe est indisponible → **503** structuré (pas de 500).

## 1. Créer le produit Stripe (manuel)

1. Ouvre [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. **Create product** → nom : `Affisell Radar Global`
3. Pricing : **Recurring** · **$99 / month** (USD) — ou EUR si ton compte est en EUR  
   (optionnel : `STRIPE_RADAR_GLOBAL_CURRENCY=eur`)
4. Enregistre → copie l’ID du **Price** (`price_…`), pas le Product ID (`prod_…`)

## 2. Variables d’environnement

### Vercel (Production + Preview)

| Key | Value |
|-----|--------|
| `STRIPE_RADAR_GLOBAL_PRICE_ID` | `price_…` (copié ci-dessus) |
| `STRIPE_RADAR_PRO_PRICE_ID` | `price_…` (optionnel ; sinon fallback `STRIPE_PRO_PRICE_ID`) |
| `STRIPE_SECRET_KEY` | `sk_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (events checkout + subscription) |

Redeploy après ajout des env.

### Local (`.env.local`)

```bash
STRIPE_RADAR_GLOBAL_PRICE_ID=price_xxxxxxxx
STRIPE_RADAR_PRO_PRICE_ID=price_yyyyyyyy   # optionnel
```

## 3. Webhook

Endpoint : `/api/stripe/webhook` (ou ta route Affisell existante).

Events utiles :

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Le processor active `User.radarPlan = global` via metadata `plan=radar_global`.

## 4. Vérifier

```bash
# Sans price id → 503 structuré
curl -s -X POST "$NEXT_PUBLIC_APP_URL/api/stripe/create-radar-checkout" \
  -H "Content-Type: application/json" \
  -d '{"plan":"global"}' | jq .

# Attendu (non auth) : 401
# Auth + price manquant : { "error": "STRIPE_GLOBAL_NOT_CONFIGURED", "message": "..." } status 503
```

Puis depuis `/pricing?feature=radar` → CTA Global, ou `/admin/radar` → « Tester checkout Global ».

## 5. UI si non configuré

Si `STRIPE_SECRET_KEY` manque aussi → toast :  
**Plan Global non configuré - voir docs/STRIPE_RADAR_SETUP.md**

Sinon le premier checkout auto-crée le price (idempotent).
