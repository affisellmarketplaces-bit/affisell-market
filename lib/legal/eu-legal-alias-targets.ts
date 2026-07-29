/** Cibles canoniques pour les alias `/legal/*` et `/fr/legal/*` (pas de doublon de contenu). */
export const EU_LEGAL_ALIAS_TARGETS = {
  "privacy-policy": "/legal/confidentialite",
  "terms-of-sale": "/legal/cgv",
  "cookie-policy": "/legal/cookies",
  "legal-notice": "/legal/mentions-legales",
  returns: "/legal/retractation",
  "protected-checkout": "/protected-checkout",
} as const

export type EuLegalAliasSlug = keyof typeof EU_LEGAL_ALIAS_TARGETS
