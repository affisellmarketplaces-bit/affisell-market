# RADAR ENV AUDIT — 2026-07-16 (updated 2026-07-19)

**Scope :** checklist Radar  
**Health :** `GET /api/radar/health` → `{ encryptionKey, redis, degradedCrawler, … }` (no secrets)

## Required vs optional

| Env | Required? | If missing |
|-----|-----------|------------|
| `ENCRYPTION_KEY` | **P0 required** (OAuth + Slack encrypt) | Throws `ENCRYPTION_KEY_MISSING` — *Add ENCRYPTION_KEY=openssl rand -hex 16 in Vercel* |
| `REDIS_URL` | **P0 recommended** (OAuth multi-instance) | Soft fail: warning + **in-memory** cron lock; OAuth start 503 when Radar on |
| `CRON_SECRET` | **P0 required** for `/api/radar/cron/*` | Cron 401 |
| `RADAR_ENABLED` | **P0** feature flag | Radar 404 |
| `DATABASE_URL` / Neon | **P0** | Health `db: false` |
| `NEXTAUTH_SECRET` | **P0** app-wide | Auth broken |
| `TIKTOK_CRAWLER_ACCESS_TOKEN` | Optional (P1) | `degradedCrawler: true` — Amazon/local continues |
| `SERPER_API_KEY` | **Optional P1** (Google Trends / Serper search) | Soft skip: warn + `[]` — cron continues TikTok+Amazon+DB; health `serper: false` |
| `RADAR_ALERTS_API_KEY` | **Required P1** (prod Slack/email send) | `POST /api/radar/alerts/send` → 401 `UNAUTHORIZED` — generate: `openssl rand -hex 16` |
| `SLACK_WEBHOOK_URL` | **Optional P1** | Send → 503 `SLACK_NOT_CONFIGURED` (pas de 500) |
| `RESEND_API_KEY` | **Optional P1** | Email soft-skip `{ emailed: false, reason: "RESEND_NOT_CONFIGURED" }` |
| `STRIPE_RADAR_GLOBAL_PRICE_ID` | Optional until $99 CTA | 503 `STRIPE_GLOBAL_NOT_CONFIGURED` — `docs/STRIPE_RADAR_SETUP.md` |
| TikTok/Amazon/Google OAuth keys | Optional until Connect | Connect start fails clearly |

```bash
openssl rand -hex 16
# or 64 hex (raw AES-256):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Admin QA: `/admin/radar` shows ENCRYPTION_KEY / REDIS / crawler from health.

---

**Source locale :** `.env.local` (valeurs jamais loggées — statut + longueur + format uniquement)  
**Vercel :** lecture `.vercel/.env.production.local` (pull local) — pas de `vercel env ls` (non exécuté)

## Score : **7/25** clés OK

| Bucket | Count |
|--------|------:|
| ✅ OK | 7 |
| 🔴 MISSING | 18 |
| 🟡 PLACEHOLDER | 0 |

### P0 manquants (crash / OAuth tokens)
- `ENCRYPTION_KEY` — **obligatoire** pour chiffrer tokens TikTok/Amazon/Google/Slack webhooks

### P0 OK local
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `RADAR_ENABLED` (on), `REDIS_URL`, `CRON_SECRET`

---

## Local `.env.local`

| Clé | Statut | Criticité | Notes (sans secret) | Action |
|-----|--------|-----------|---------------------|--------|
| DATABASE_URL | ✅ OK | P0 | présent, 152 chars, postgres URL | Neon → Connection string pooled |
| NEXTAUTH_SECRET | ✅ OK | P0 | présent, 44 chars, longueur OK | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| RADAR_ENABLED | ✅ OK | P0 | présent, 4 chars, flag=on | Garder `true` en Preview/Prod |
| RADAR_PLANS_ENABLED | ✅ OK | P2 | présent, 4 chars, flag=on | Paywall actif |
| ENCRYPTION_KEY | 🔴 MISSING | P0 | absent | `openssl rand -hex 16` → Vercel + `.env.local` |
| REDIS_URL | ✅ OK | P0 | présent, 113 chars, redis URL | Upstash — cron OK sans Redis (memory lock) |
| CRON_SECRET | ✅ OK | P0 | présent, 64 chars | Bearer pour `/api/radar/cron/*` |
| RADAR_DATABASE_URL | 🔴 MISSING | P1 | absent | Optionnel si Neon `DATABASE_URL` OK + `npm run radar:db:push` |
| RADAR_BETA_USER_IDS | 🔴 MISSING | P2 | absent | IDs/emails comma-separated → plan Global |
| SERPER_API_KEY | 🔴 MISSING | **P1 optional** | absent | https://serper.dev — Trends only; cron degraded-OK without it |
| TIKTOK_CRAWLER_ACCESS_TOKEN | 🔴 MISSING | P1 | absent | Bearer crawler TikTok (Partner token / Apify) — required by global-scan |
| SERPAPI_API_KEY | 🔴 MISSING | P1 | absent | Fallback SerpAPI |
| PROXY_URL | 🔴 MISSING | P2 | absent | Optionnel crawler |
| TIKTOK_CLIENT_KEY | 🔴 MISSING | P1 | absent | TikTok Shop Partner Center |
| TIKTOK_CLIENT_SECRET | 🔴 MISSING | P1 | absent | TikTok Shop Partner Center |
| TIKTOK_REDIRECT_URI | 🔴 MISSING | P1 | absent | `{APP}/api/radar/tiktok/callback` |
| AMAZON_LWA_CLIENT_ID | 🔴 MISSING | P1 | absent | Amazon LWA |
| AMAZON_LWA_CLIENT_SECRET | 🔴 MISSING | P1 | absent | Amazon LWA |
| AMAZON_SP_API_APPLICATION_ID | 🔴 MISSING | P1 | absent | SP-API Application ID |
| AMAZON_SP_API_ENDPOINT | 🔴 MISSING | P1 | absent | `https://sellingpartnerapi-eu.amazon.com` |
| AMAZON_SP_API_ROLE_ARN | 🔴 MISSING | P2 | absent | IAM ARN optionnel (LWA-only OK) |
| GOOGLE_CLIENT_ID | 🔴 MISSING | P1 | absent | Google Cloud OAuth |
| GOOGLE_CLIENT_SECRET | 🔴 MISSING | P1 | absent | Google Cloud OAuth |
| GOOGLE_REDIRECT_URI | 🔴 MISSING | P1 | absent | `{APP}/api/radar/google/merchant/callback` |
| SLACK_WEBHOOK_URL | 🔴 MISSING | **P1 optional** | absent | Incoming Webhook — send → 503 if missing |
| RADAR_ALERTS_API_KEY | 🔴 MISSING | **P1 required prod** | absent | `openssl rand -hex 16` → header `x-api-key` |
| RESEND_API_KEY | — | **P1 optional** | (app-wide often set) | Radar email alerts soft-skip if absent |
| STRIPE_SECRET_KEY | ✅ OK | P2 | présent, 107 chars, stripe sk_ prefix OK | Dashboard Stripe |

---

## Vercel (lecture seule locale)

| Source | Résultat |
|--------|----------|
| `.vercel/.env.production.local` | Fichier présent (~4 KB) — **0/25** clés Radar checklist marquées OK (absentes ou vides dans ce pull) |
| `vercel env ls` | Non exécuté (évite fuite config distante) |

### À ajouter dans Vercel Dashboard → Project → Settings → Environment Variables

Copier-coller (Production + Preview) :

| Key | Env | Notes |
|-----|-----|-------|
| `RADAR_ENABLED` | Production, Preview | `true` |
| `RADAR_PLANS_ENABLED` | Production, Preview | `true` |
| `ENCRYPTION_KEY` | Production, Preview | `openssl rand -hex 16` (ou 64 hex) — **même valeur** local/prod si tokens déjà chiffrés |
| `REDIS_URL` | Production, Preview | Upstash |
| `CRON_SECRET` | Production, Preview | Aligné GitHub Actions / Vercel Cron |
| `DATABASE_URL` | Production, Preview | Neon (déjà souvent présent) |
| `NEXTAUTH_SECRET` | Production, Preview | déjà souvent présent |
| `SERPER_API_KEY` | Production, Preview | Trends + global-scan — https://serper.dev |
| `TIKTOK_CRAWLER_ACCESS_TOKEN` | Production, Preview | Bearer TikTok search/trending (Partner token ou Apify) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | Production, Preview | OAuth TikTok |
| `TIKTOK_REDIRECT_URI` | Production, Preview | `https://affisell.com/api/radar/tiktok/callback` |
| `AMAZON_LWA_CLIENT_ID` / `AMAZON_LWA_CLIENT_SECRET` / `AMAZON_SP_API_APPLICATION_ID` | Production, Preview | SP-API |
| `AMAZON_SP_API_ENDPOINT` | Production, Preview | `https://sellingpartnerapi-eu.amazon.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Production, Preview | Merchant |
| `GOOGLE_REDIRECT_URI` | Production, Preview | `https://affisell.com/api/radar/google/merchant/callback` |
| `SLACK_WEBHOOK_URL` | Production (optionnel) | fallback global |
| `RADAR_BETA_USER_IDS` | Production, Preview | fondateurs |
| `STRIPE_SECRET_KEY` | Production, Preview | billing (si pas déjà là) |

---

## Template

Fichier généré (ne remplace pas `.env.local`) :

→ [`.env.local.radar.template`](../.env.local.radar.template)

Fusion manuelle :
```bash
# 1) Génère ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2) Copie les lignes manquantes depuis .env.local.radar.template → .env.local
# 3) Remplace les placeholders EXAMPLE_*
# 4) Push schema Radar
npm run radar:db:push
```

---

## Commandes pour fixer (P0 d’abord)

```bash
# ENCRYPTION_KEY (64 hex) — coller dans .env.local + Vercel
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Vérifier présence sans dump secret
node -e "
const fs=require('fs');
const t=fs.readFileSync('.env.local','utf8');
for (const k of ['ENCRYPTION_KEY','REDIS_URL','CRON_SECRET','RADAR_ENABLED']) {
  const m=t.match(new RegExp('^'+k+'=(.*)$','m'));
  const v=m?m[1].replace(/^[\"\\']|[\"\\']$/g,''):'';
  console.log(k+':', v?('présent, '+v.length+' chars'):'MISSING');
}
"
```

Pas de script `npm run radar:env:check` dans le repo aujourd’hui — utiliser le check ci-dessus ou relire ce doc.

---

## Impact produit (ordre)

1. **P0** `ENCRYPTION_KEY` → OAuth connect + Slack encrypt cassés sans ça  
2. **P0** `REDIS_URL` → OAuth multi-instance ; cron global-scan OK avec memory lock  
3. **P1** Serper + TikTok crawler → `degradedCrawler` si TikTok token absent  
4. **P2** Slack / Stripe / beta IDs → revenue & alertes
