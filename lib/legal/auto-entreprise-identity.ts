/** Identité légale Affisell — extrait Kbis RCS Aix-en-Provence (15/09/2025). */

export const AFFISELL_LEGAL_IDENTITY = {
  commercialName: "Affisell",
  /** État civil Kbis : HOUAGA Julien, Nelson, Wolfgang */
  legalName: "HOUAGA Julien Nelson Wolfgang",
  legalForm:
    "Entreprise individuelle — micro-entreprise (auto-entreprise) en franchise de base de TVA",
  siret: "99119663500015",
  siren: "991196635",
  /** Greffe / RCS sur l’extrait d’immatriculation. */
  rcs: "991 196 635 R.C.S. Aix-en-Provence",
  nafCode: "4791B",
  nafLabel: "Vente à distance sur catalogue spécialisé",
  /**
   * Siège publié (établissement Kbis) — sans détail logement.
   * Overridable via COMPANY_ADDRESS / COMPANY_DOMICILIATION_ADDRESS.
   */
  address: "20 Rue de Cuques, 13100 Aix-en-Provence",
  establishmentAddress: "20 Rue de Cuques, 13100 Aix-en-Provence",
  /** @deprecated kept for older callers — same as `address`. */
  addressPlaceholder: "20 Rue de Cuques, 13100 Aix-en-Provence",
  emailPlaceholder: "[À compléter — e-mail de contact]",
  vatRegimeFr: "TVA non applicable, art. 293 B du CGI",
  activitySince: "09/09/2025",
  rcsRegisteredAt: "15/09/2025",
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

export const LEGAL_LAUNCH_VERSION = "2026-07-30"
