import { SUPPLIER_DAC7_EUR_THRESHOLD, SUPPLIER_DAC7_TRANSACTION_THRESHOLD } from "@/lib/supplier-become-page-finance"

/** Partner commission range on supplier catalogue HT (per listing). */
export const AFFILIATE_COMMISSION_MIN_PCT = 10
export const AFFILIATE_COMMISSION_MAX_PCT = 30

/** Last-click attribution window disclosed to partners. */
export const AFFILIATE_ATTRIBUTION_COOKIE_DAYS = 30

/** Minimum Connect balance before monthly payout batch (disclosure only — not enforced in transfer code). */
export const AFFILIATE_PAYOUT_MIN_CENTS = 5000

/** Legacy disclosure constant — runtime uses per-order delivery gating (see payoutPolicy i18n). */
export const AFFILIATE_PAYOUT_DELAY_DAYS = 30

/** Sanction window — withheld earnings on policy breach. */
export const AFFILIATE_SANCTION_EARNINGS_HOLD_DAYS = 90

export const AFFILIATE_PROGRAM_PROHIBITIONS = [
  "spam",
  "brandMisuse",
  "fakeReviews",
  "googleAdsOnAffisellName",
] as const

export type AffiliateProgramProhibition = (typeof AFFILIATE_PROGRAM_PROHIBITIONS)[number]

export type AffiliateTaxResidenceRow = {
  code: string
  labelFr: string
  labelEn: string
  regimeFr: string
  regimeEn: string
}

/** Accountant-facing tax hints — not legal advice. */
export const AFFILIATE_TAX_RESIDENCE_ROWS: AffiliateTaxResidenceRow[] = [
  {
    code: "FR",
    labelFr: "France",
    labelEn: "France",
    regimeFr:
      "Micro-BNC (si éligible) ou régime réel. Franchise TVA jusqu'à ~36 000 €/an de CA — au-delà, TVA à déclarer.",
    regimeEn:
      "Micro-BNC (if eligible) or standard regime. VAT exemption up to ~€36k revenue — above that, VAT registration required.",
  },
  {
    code: "BJ",
    labelFr: "Bénin",
    labelEn: "Benin",
    regimeFr: "ISB 1 % sur les revenus de plateforme numérique (créateurs / affiliés).",
    regimeEn: "1% digital platform income tax (ISB) on platform earnings.",
  },
  {
    code: "BE",
    labelFr: "Belgique",
    labelEn: "Belgium",
    regimeFr: "Revenus BNC / indépendant — TVA selon seuils belges et nature d'activité.",
    regimeEn: "Self-employed income — VAT per Belgian thresholds and activity.",
  },
  {
    code: "CH",
    labelFr: "Suisse",
    labelEn: "Switzerland",
    regimeFr: "Déclaration selon canton — pas de salariat avec Affisell.",
    regimeEn: "Canton-specific filing — no employment relationship with Affisell.",
  },
  {
    code: "OTHER",
    labelFr: "Autre pays",
    labelEn: "Other country",
    regimeFr: "Déclarez vos revenus partenaire selon le droit local. Affisell peut transmettre DAC7.",
    regimeEn: "Declare partner earnings under local law. Affisell may file DAC7 reporting.",
  },
]

export type AffiliateCatalogVertical = {
  icon: string
  labelFr: string
  labelEn: string
}

/** Category chips only — no supplier identity (anti-scraping / RGPD). */
export const AFFILIATE_CATALOG_VERTICALS: AffiliateCatalogVertical[] = [
  { icon: "👕", labelFr: "Mode", labelEn: "Fashion" },
  { icon: "💄", labelFr: "Beauté", labelEn: "Beauty" },
  { icon: "📱", labelFr: "High-tech", labelEn: "Electronics" },
  { icon: "🏡", labelFr: "Maison", labelEn: "Home" },
  { icon: "🏋️", labelFr: "Sport", labelEn: "Sports" },
  { icon: "🧸", labelFr: "Enfants", labelEn: "Kids" },
  { icon: "🐾", labelFr: "Animaux", labelEn: "Pets" },
  { icon: "🎮", labelFr: "Gaming", labelEn: "Gaming" },
]

export const affiliateProgramFinanceFacts = {
  commissionMinPct: AFFILIATE_COMMISSION_MIN_PCT,
  commissionMaxPct: AFFILIATE_COMMISSION_MAX_PCT,
  cookieDays: AFFILIATE_ATTRIBUTION_COOKIE_DAYS,
  payoutMinCents: AFFILIATE_PAYOUT_MIN_CENTS,
  payoutDelayDays: AFFILIATE_PAYOUT_DELAY_DAYS,
  sanctionHoldDays: AFFILIATE_SANCTION_EARNINGS_HOLD_DAYS,
  dac7EurThreshold: SUPPLIER_DAC7_EUR_THRESHOLD,
  dac7TxThreshold: SUPPLIER_DAC7_TRANSACTION_THRESHOLD,
} as const
