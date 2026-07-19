# Stripe — Affisell Radar Global ($99)

Sans `STRIPE_RADAR_GLOBAL_PRICE_ID`, le checkout Global renvoie **503**  
`{ "error": "STRIPE_GLOBAL_NOT_CONFIGURED" }` (plus de crash 500).

## 1. Créer le produit Stripe

1. Ouvre [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. **Create product** → nom : `Affisell Radar Global`
3. Pricing : **Recurring** · **$99 / month** (USD) — ou EUR si ton compte est en EUR
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

Toast : **Plan Global non configuré - voir docs/STRIPE_RADAR_SETUP.md**
