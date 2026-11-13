# Checklist Vercel Production — pas à pas

Active les intégrations ops une par une. Après chaque étape, lance la commande de vérif indiquée.

> Ce fichier est un **pas-à-pas d'activation en Production**. La liste complète des réglages côté services (variables par environnement, Stripe, Neon, Replicate, Redis, Sentry, alertes), avec
> vérification et retour arrière, est dans `docs/EXTERNAL-OPS-RUNBOOK.md` ; l'isolation Preview / Production dans `docs/ENVIRONMENTS.md`.
> **Schéma de base de données** : jamais `npx prisma migrate deploy` ni `npm run migrate:deploy` (ils visent la base **par défaut**, c'est-à-dire la production, quelle que soit l'URL passée — `AGENTS.md`).
> On applique une migration **à la main, avant le push**, avec `DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep-id> [--confirm-production]`, puis `npm run schema:verify`
> (`docs/DEPLOY-SCHEMA-CHANGES.md` §5). Le build Vercel ne migre jamais : il vérifie.
> **Clés live** : uniquement dans l'environnement **Production**. Un Preview reçoit des clés **test** ; le code refuse une clé Stripe live hors production.

## Prérequis

- Projet déployé sur Vercel (Production)
- Accès **Settings → Environment Variables** (Production)
- Accès **GitHub → Settings → Secrets and variables → Actions**

---

## Étape 1 — Stripe webhook (idempotence checkout)

**Pourquoi :** les commandes marketplace sont créées via `checkout.session.completed` ; le webhook doit pointer vers prod avec le bon secret.

1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → **Add endpoint**
2. URL : `https://affisell.com/api/webhooks/stripe` (une seule des deux routes ; `/api/stripe/webhook` est l'ancienne URL, qui délègue au même code)
3. Événements traités par le code (`lib/stripe-webhook-processor.ts`) : `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `account.updated` — **plus** `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`,
   `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated` (litiges : reçus et journalisés `skipped`, **pas encore traités** par le code — D7 du master ; l'activation est sans risque).
   `account.updated` des comptes connectés demande un point d'accès « comptes connectés » avec son propre secret : voir `docs/EXTERNAL-OPS-RUNBOOK.md` §5 S2.
4. Copier le **Signing secret** → Vercel Production :
   - `STRIPE_WEBHOOK_SECRET=whsec_…`
5. Vérifier aussi : `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (mode live, **Production seulement** ; Preview = clés test et point d'accès de test)

**Test :** paiement test → une seule commande en DB pour le `stripeSessionId` (pas de `Unique constraint failed`).

---

## Étape 2 — CRON_SECRET (crons GitHub + Vercel)

**Pourquoi :** les routes `/api/cron/*` exigent `Authorization: Bearer ${CRON_SECRET}`.
(Exceptions connues, finalisation master C3 : `ing-manual-nudge` et `legal-guardian` acceptent aussi l'en-tête `x-vercel-cron`, falsifiable ; certaines routes acceptent `?secret=` — à corriger dans le code, pas ici.)

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
3. Base de données — la table `PushSubscription` vient d'une migration : l'appliquer **à la main, avant le push** (staging d'abord, puis production), jamais par `npx prisma migrate deploy` :
   ```bash
   DATABASE_URL='<url staging ou production>' npm run schema:migrate -- --expect-endpoint <ep-id> [--confirm-production]
   DATABASE_URL='<url>' npm run schema:verify
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
| `CRON_SECRET` | 2 | Oui (unique, ≠ tout autre secret) |
| `REPLICATE_WEBHOOK_SECRET` | `docs/EXTERNAL-OPS-RUNBOOK.md` §6 | Si l'essayage virtuel est activé |
| `AUTO_BUY_ENABLED` | — | **Ne pas poser** (auto-buy désactivé par décision du fondateur) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 3 | Oui (push) |
| `VAPID_PRIVATE_KEY` | 3 | Oui (push) |
| `VERCEL_API_TOKEN` | 4 | Oui (domaines custom) |
| `VERCEL_PROJECT_ID` | 4 | Oui (domaines custom) |
| `NOTION_API_KEY` | 5 | Si CRM enterprise |
| `NOTION_CRM_DATABASE_ID` | 5 | Si CRM enterprise |
| `RESEND_API_KEY` | 6 | Oui |
| `RESEND_FROM_EMAIL` | 6 | Oui |
