/** Identité légale Affisell — lancement auto-entreprise (source unique, sans secrets). */

export const AFFISELL_LEGAL_IDENTITY = {
  commercialName: "Affisell",
  legalName: "HOUAGA Nelson Wolfgang",
  legalForm:
    "Entreprise individuelle — micro-entreprise (auto-entreprise) en franchise de base de TVA",
  siret: "99119663500015",
  siren: "991196635",
  nafCode: "4791B",
  nafLabel: "Vente à distance sur catalogue spécialisé",
  /** Affiché tant que COMPANY_ADDRESS n'est pas défini. */
  addressPlaceholder: "[À compléter — adresse de domiciliation]",
  emailPlaceholder: "[À compléter — e-mail de contact]",
  vatRegimeFr: "TVA non applicable, art. 293 B du CGI",
  activitySince: "09/09/2025",
  activitySummary:
    "Exploitation de la marketplace Affisell, outil DropForge, et mise en relation entre fournisseurs, revendeurs et acheteurs.",
  hostPrimary: {
    name: "Vercel Inc.",
    street: "440 N Barranca Ave #4133",
    city: "Covina",
    state: "CA",
    postalCode: "91723",
    countryFr: "États-Unis",
    website: "https://vercel.com",
  },
  hostSecondary: {
    name: "Supabase Inc.",
    roleFr: "Base de données et services backend (sous-traitant)",
    website: "https://supabase.com",
  },
  processors: [
    { name: "Stripe", role: "Paiements et KYC" },
    { name: "ScrapingBee", role: "Collecte technique de données produits (imports)" },
    { name: "AliExpress Open Platform", role: "API catalogue / fulfillment (DropForge)" },
    { name: "Vercel", role: "Hébergement applicatif" },
    { name: "Supabase", role: "Hébergement données" },
  ],
} as const

export const LEGAL_LAUNCH_VERSION = "2026-07-29"
