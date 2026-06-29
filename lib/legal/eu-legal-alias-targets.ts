/** Cibles canoniques pour les alias `/legal/*` et `/fr/legal/*` (pas de doublon de contenu). */
export const EU_LEGAL_ALIAS_TARGETS = {
  "privacy-policy": "/privacy",
  "terms-of-sale": "/cgv",
  "cookie-policy": "/cookies",
  "legal-notice": "/legal/mentions",
  returns: "/protected-checkout",
  "protected-checkout": "/protected-checkout",
} as const

export type EuLegalAliasSlug = keyof typeof EU_LEGAL_ALIAS_TARGETS
