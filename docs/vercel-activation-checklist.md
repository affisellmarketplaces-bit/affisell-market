# Checklist Vercel Production — pas à pas

Active les intégrations ops une par une. Après chaque étape, lance la commande de vérif indiquée.

## Prérequis

- Projet déployé sur Vercel (Production)
- Accès **Settings → Environment Variables** (Production)
- Accès **GitHub → Settings → Secrets and variables → Actions**

---

## Étape 1 — Stripe webhook (idempotence checkout)

**Pourquoi :** les commandes marketplace sont créées via `checkout.session.completed` ; le webhook doit pointer vers prod avec le bon secret.

1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → **Add endpoint**
2. URL : `https://affisell.com/api/webhooks/stripe`
3. Événements minimum : `checkout.session.completed`, `charge.refunded`, `invoice.payment_failed`, `customer.subscription.deleted`
4. Copier le **Signing secret** → Vercel Production :
   - `STRIPE_WEBHOOK_SECRET=whsec_…`
5. Vérifier aussi : `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (mode live)

**Test :** paiement test → une seule commande en DB pour le `stripeSessionId` (pas de `Unique constraint failed`).

---

## Étape 2 — CRON_SECRET (crons GitHub + Vercel)

**Pourquoi :** toutes les routes `/api/cron/*` exigent `Authorization: Bearer ${CRON_SECRET}`.

1. Générer un secret fort (32+ chars) :
   ```bash
   openssl rand -base64 32
   ```
2. Vercel Production → `CRON_SECRET=<valeur>`
3. GitHub repo → **Secrets** → `CRON_SECRET` (même valeur)
4. Redéployer Production après ajout

**Test :**
```bash
npm run verify:ops
```
→ doit afficher `CRON_SECRET configured` (warning acceptable en local sans `.env`).

---

## Étape 3 — Web Push (alertes prix + commandes expédiées/livrées)

**Pourquoi :** notifications navigateur pour acheteurs opt-in.

1. Générer les clés VAPID :
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Vercel Production :
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=…`
   - `VAPID_PRIVATE_KEY=…`
   - `VAPID_SUBJECT=mailto:support@affisell.com` (optionnel si `RESEND_FROM_EMAIL` défini)
3. Base de données :
   ```bash
   npx prisma migrate deploy
   ```
4. Redéployer

**Test :**
```bash
npm run verify:web-push
```

**Smoke prod :** `/marketplace/account` → activer les notifications → déclencher une alerte wishlist ou marquer une commande expédiée.

---

## Étape 4 — Domaines marchands 1-clic (SSL Vercel)

**Pourquoi :** activation auto des domaines custom (`CNAME` → `cname.affisell.com`) sans intervention manuelle.

1. Vercel → **Account Settings → Tokens** → créer un token avec accès au projet
2. Vercel → projet Affisell → **Settings → General** → copier **Project ID**
3. Vercel Production :
   - `VERCEL_API_TOKEN=…`
   - `VERCEL_PROJECT_ID=…`
   - `STORE_CNAME_TARGET=cname.affisell.com` (défaut si absent)
4. Cron GitHub `sync-store-vercel-domains` (workflow `scheduled-crons.yml`) — nécessite `CRON_SECRET` (étape 2)

**Test :**
```bash
npm run verify:store-domains
npm run verify:ops
```

**Smoke prod :** marchand ajoute un domaine → DNS CNAME → **Activate domain + SSL** dans `/dashboard/*/settings/store`.

---

## Étape 5 — Notion CRM (enterprise `/enterprise/apply`)

**Pourquoi :** pipeline leads enterprise synchronisé vers Notion.

1. [Notion Integrations](https://www.notion.so/my-integrations) → créer une intégration
2. Partager la base CRM avec l'intégration (accès **Can edit**)
3. Copier l’ID de la base (UUID dans l’URL)
4. Vercel Production :
   - `NOTION_API_KEY=secret_…`
   - `NOTION_CRM_DATABASE_ID=…`

**Test :**
```bash
npm run verify:notion-crm
```

Doc schéma : `docs/crm-notion-supplier-pipeline.md`

---

## Étape 6 — Email (Resend)

**Pourquoi :** confirmations commande, alertes marchands, emails transactionnels.

Vercel Production :
- `RESEND_API_KEY=re_…`
- `RESEND_FROM_EMAIL=Affisell <noreply@affisell.com>` (domaine vérifié chez Resend)

**Test :** commande test → email confirmation reçu (ou `TEST_EMAIL_TO` en preview).

---

## Étape 7 — Expansion ROW (optionnel)

**Pourquoi :** pilotes pays + graduation automatique.

Variables typiques : webhook Stripe prod, DB prod, crons actifs.

**Test :**
```bash
npm run verify:expansion
```

---

## Étape 8 — Video Pro paywall (optionnel, pause fondateur)

Par défaut le paywall est **en pause** (`VIDEO_PAYWALL_PAUSED` absent ou `1`).

Pour réactiver la limite 3 vidéos + Stripe Pro :
1. Vercel Production : `VIDEO_PAYWALL_PAUSED=0`, `STRIPE_PRO_PRICE_ID=price_…`
2. ```bash
   npm run verify:video-paywall
   ```

---

## Vérification globale (fin de checklist)

```bash
npm run verify:ops
npm run verify:web-push
npm run verify:notion-crm   # si Notion activé
npm run verify:store-domains
```

Puis redéployer Production et contrôler :
- [ ] Paiement Stripe → 1 commande / session
- [ ] Webhook Stripe → 200 OK (Dashboard Stripe → Webhooks → attempts)
- [ ] Push notifications (opt-in acheteur)
- [ ] Domaine marchand custom → HTTPS actif
- [ ] Cron GitHub Actions → dernier run OK (`scheduled-crons.yml`)

---

## Référence rapide des variables

| Variable | Étape | Obligatoire prod |
|----------|-------|------------------|
| `STRIPE_WEBHOOK_SECRET` | 1 | Oui |
| `CRON_SECRET` | 2 | Oui |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 3 | Oui (push) |
| `VAPID_PRIVATE_KEY` | 3 | Oui (push) |
| `VERCEL_API_TOKEN` | 4 | Oui (domaines custom) |
| `VERCEL_PROJECT_ID` | 4 | Oui (domaines custom) |
| `NOTION_API_KEY` | 5 | Si CRM enterprise |
| `NOTION_CRM_DATABASE_ID` | 5 | Si CRM enterprise |
| `RESEND_API_KEY` | 6 | Oui |
| `RESEND_FROM_EMAIL` | 6 | Oui |
