import type { RadarCheckoutPlanId, RadarPlanId } from "@/lib/radar/plans"
import { RADAR_PLANS } from "@/lib/radar/plans"

export type RadarPricingFeature = {
  label: string
  detail?: string
  included: boolean
  highlight?: boolean
}

export type RadarPricingCardCopy = {
  planId: RadarPlanId
  checkoutPlan: RadarCheckoutPlanId | null
  badge?: string
  eyebrow: string
  blurb: string
  outcome: string
  features: RadarPricingFeature[]
  ctaHint?: string
}

/**
 * Conversion-first Radar pricing copy — shared by /pricing?feature=radar
 * and the public /radar marketing landing. Quotas stay sourced from RADAR_PLANS.
 */
export function buildRadarPricingCards(): RadarPricingCardCopy[] {
  const starter = RADAR_PLANS.starter
  const pro = RADAR_PLANS.pro
  const global = RADAR_PLANS.global

  return [
    {
      planId: starter.id,
      checkoutPlan: null,
      eyebrow: "Essai signal",
      blurb: "Goûte au pulse marché sans engagement — 1 shop pour valider le workflow.",
      outcome: "Idéal pour scanner ton premier niche avant de scaler.",
      features: [
        {
          label: `${starter.maxShops} shop connectée`,
          detail: "TikTok Shop, Amazon ou Merchant Center",
          included: true,
        },
        {
          label: `${starter.maxProducts.toLocaleString("fr-FR")} produits crawlés`,
          detail: "Catalogue de test pour valider le scoring",
          included: true,
        },
        {
          label: "Winners live <30j",
          detail: "Réservé Radar Pro+",
          included: false,
        },
        {
          label: "Carte monde temps réel",
          included: false,
        },
        {
          label: "Alertes Slack 3h du matin",
          included: false,
        },
      ],
    },
    {
      planId: pro.id,
      checkoutPlan: "pro",
      badge: "Le plus choisi",
      eyebrow: "Arme opérationnelle",
      blurb: "Tu vois les winners avant tes concurrents locaux — map, alertes, score Affisell.",
      outcome: "Un seul produit gagnant rembourse souvent plusieurs mois de Pro.",
      features: [
        {
          label: `${pro.maxShops} shops synchronisées`,
          detail: "Multi-marketplace, refresh automatique",
          included: true,
          highlight: true,
        },
        {
          label: `${pro.maxProducts.toLocaleString("fr-FR")} produits sous radar`,
          detail: "Scoring rank · ventes · saturation",
          included: true,
        },
        {
          label: `${pro.maxAlerts} alertes prioritaires`,
          detail: "Email + inbox Radar quand un signal critique monte",
          included: true,
        },
        {
          label: "Map monde live",
          detail: "Hotspots BR / US / EU / SEA en un coup d’œil",
          included: true,
          highlight: true,
        },
        {
          label: "Winners détectés <30 jours",
          detail: "Top opportunités avant la saturation",
          included: true,
        },
        {
          label: "Slack 3h du matin",
          detail: "Réservé Radar Global",
          included: false,
        },
      ],
      ctaHint: "Activation Stripe · annulation en 1 clic",
    },
    {
      planId: global.id,
      checkoutPlan: "global",
      badge: "Couverture mondiale",
      eyebrow: "Avantage asymétrique",
      blurb: "Crawl mondial + Slack à 3h — tu trades pendant que le marché dort.",
      outcome: "Conçu pour équipes qui scalent sur plusieurs marchés le même jour.",
      features: [
        {
          label: `${global.maxShops} shops · ops multi-pays`,
          detail: "Pipeline reseller / grossiste / marque",
          included: true,
          highlight: true,
        },
        {
          label: `${global.maxProducts.toLocaleString("fr-FR")} produits crawlés`,
          detail: "Couverture catalogue ×10 vs Pro",
          included: true,
        },
        {
          label: `${global.maxAlerts} alertes haute fréquence`,
          detail: "File prioritaire pour ne rater aucun spike",
          included: true,
        },
        {
          label: "Map monde + chaleur géo",
          detail: "Lire la dynamique marché en temps réel",
          included: true,
        },
        {
          label: "Slack WINNER DETECTED · 3h",
          detail: "Signal CRITICAL avant l’ouverture EU",
          included: true,
          highlight: true,
        },
        {
          label: "Veille défense prix",
          detail: "Police des prix & surveillance GMC",
          included: true,
        },
      ],
      ctaHint: "Priorité crawl + support upgrade",
    },
  ]
}

export const RADAR_PRICING_TRUST = [
  { label: "1M+", detail: "produits scannés / jour" },
  { label: "<30j", detail: "fenêtre winner Affisell" },
  { label: "3h", detail: "alerte Slack Global" },
  { label: "1 clic", detail: "upgrade Stripe sécurisé" },
] as const

export const RADAR_PRICING_PROOF = [
  "Paiement Stripe sécurisé · facturation mensuelle claire",
  "Tu gardes ton accès tant que l’abonnement est actif",
  "Upgrade / downgrade sans perdre ton historique Radar",
] as const
