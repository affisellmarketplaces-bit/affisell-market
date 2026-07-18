# RADAR ENV AUDIT — 2026-07-16

**Scope :** checklist Radar (25 clés)  
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
| ENCRYPTION_KEY | 🔴 MISSING | P0 | absent | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` → **64 hex** |
| REDIS_URL | ✅ OK | P0 | présent, 113 chars, redis URL | Upstash `rediss://…` |
| CRON_SECRET | ✅ OK | P0 | présent, 64 chars | Bearer pour `/api/radar/cron/*` |
| RADAR_DATABASE_URL | 🔴 MISSING | P1 | absent | Optionnel si Neon `DATABASE_URL` OK + `npm run radar:db:push` |
| RADAR_BETA_USER_IDS | 🔴 MISSING | P2 | absent | IDs/emails comma-separated → plan Global |
| SERPER_API_KEY | 🔴 MISSING | P1 | absent | https://serper.dev (Trends + cron skip sans keys) |
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
| SLACK_WEBHOOK_URL | 🔴 MISSING | P2 | absent | Slack Incoming Webhook (ou UI settings chiffré) |
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
| `ENCRYPTION_KEY` | Production, Preview | 64 hex — **même valeur** que local si tokens déjà chiffrés |
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
2. **P1** Serper + TikTok/Amazon/Google → dashboard/cron/connectors vides  
3. **P2** Slack / Stripe / beta IDs → revenue & alertes
