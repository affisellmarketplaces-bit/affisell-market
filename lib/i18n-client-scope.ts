import type { AbstractIntlMessages } from "next-intl"

/**
 * Which message namespaces reach the browser.
 *
 * The root layout used to send the WHOLE catalog (≈340 KB of JSON for EN, inlined in every HTML page as the RSC
 * payload of `NextIntlClientProvider`). Public pages now get every namespace EXCEPT the ones below, which only client
 * code under `/dashboard` and `/admin` reads; those two layouts add them back with `<IntlScope>` (a soft navigation
 * from a public page into a dashboard keeps the root layout mounted, so the extension — not the root — must carry them).
 *
 * The list is DERIVED and CHECKED by lib/__tests__/i18n-client-scope.test.ts: it walks every public route's import
 * graph and fails if any client component reachable from a public page reads one of these namespaces.
 */
export const PRIVATE_SURFACE_NAMESPACES: readonly string[] = [
  "supplier",
  "affiliate",
  "supplierDashboard",
  "companyPages",
  "affiliateDashboard",
  "supplierOrders",
  "legalPages",
  "footer",
  "faq",
  "sellBecomeSupplier",
  "productExclusivity",
  "sellAffiliateProgram",
  "payoutPolicy",
  "pages",
  "supplierShipping",
  "aiConnect",
  "sponsorBoost",
  "supplierPhotos",
  "sellPage",
  "howItWorks",
  "radarDiscovery",
  "Filters",
  "productSpecs",
  "BookingPass",
  "supplierQuality",
  "homeDiscover",
  "buyerBestsellers",
  "dashboardCharts",
  "browseCategory",
  "supplierStore",
  "AI",
  "globalError",
  "ProductCommon",
  "cancel",
  "marketplacePulse",
  "Menu",
]

/** Namespaces the product page reads through `useMessages()` — added by `<IntlScope>` around the product detail. */
export const PDP_NAMESPACES = ["Product", "Breadcrumb", "checkout", "cart", "wishlist"] as const

export function omitNamespaces(messages: AbstractIntlMessages, names: readonly string[]): AbstractIntlMessages {
  const drop = new Set(names)
  const out: AbstractIntlMessages = {}
  for (const [key, value] of Object.entries(messages)) if (!drop.has(key)) out[key] = value
  return out
}

export function pickNamespaces(messages: AbstractIntlMessages, names: readonly string[]): AbstractIntlMessages {
  const out: AbstractIntlMessages = {}
  for (const name of names) if (messages[name] !== undefined) out[name] = messages[name]
  return out
}
