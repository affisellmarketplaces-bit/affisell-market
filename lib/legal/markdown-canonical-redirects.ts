/** Slugs markdown `/legal/[slug]` → pages React canoniques (évite doublon CGU/CGS). */
export const LEGAL_MARKDOWN_CANONICAL_REDIRECTS: Record<string, string> = {
  "terms-of-service": "/cgu",
  "terms-supplier": "/conditions-fournisseur",
  "terms-affiliate": "/conditions-affilie",
  "privacy-policy": "/privacy",
  "cookies-policy": "/cookies",
  mentions: "/mentions-legales",
}
