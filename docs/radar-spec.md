# Affisell Radar Spec V3

## Pourquoi
Affisell Radar unifie les signaux Google et marketplaces pour aider un marchand a detecter plus vite les opportunites catalogue, pricing et expansion.

## Scope V3
- Rebrand complet de `Market Intelli` vers `Affisell Radar`.
- Surface produit publique sous `/radar` avec compatibilite de build et de routing pour `/intelli`.
- Ingestion progressive multi-sources avec TikTok Shop comme connecteur actif initial.

## Sources V3

### Google
- Merchant Center
  - flux catalogue
  - erreurs produits
  - prix et disponibilite
- Search Console
  - requetes top impressions
  - CTR par page produit
  - intentions SEO a convertir en pages marchandes

### Marketplaces EU
- Amazon EU
- Allegro
- Bol.com

### Marketplaces Americas
- Amazon US
- Walmart
- MercadoLibre

### Marketplaces Asia
- Shopee
- Lazada

### Marketplaces Africa & MENA
- Jumia
- Noon
- Takealot

## Signaux attendus
- sante du catalogue
- deltas de prix
- tendances de ventes
- signaux de demande
- priorites d'expansion par zone

## UX V3
- dashboard `/radar`
  - etat vide oriente action
  - badge `Signal Actif` sur chaque source connectee
  - CTA principal `Scanner un marketplace`
- page `/radar/connect`
  - groupes de sources par zone
  - TikTok Shop disponible immediatement via OAuth
  - autres sources affichees comme slots d'integration Radar

## Compatibilite
- `/intelli` redirige en `301` vers `/radar`
- `/api/intelli/*` redirige en `301` vers `/api/radar/*`
- fallback env pendant transition:
  - `RADAR_ENABLED || MARKET_INTELLI_ENABLED`
  - `RADAR_DATABASE_URL || MARKET_INTELLI_DATABASE_URL`
  - `RADAR_BETA_USER_IDS || MARKET_INTELLI_BETA_USER_IDS`

## Notes implementation
- build doit rester safe si `RADAR_ENABLED=false`
- Prisma client conserve la meme sortie generatee pour eviter une migration de runtime inutile
- les anciens imports `@/lib/market-intelli/*` restent des aliases vers `@/lib/radar/*`
