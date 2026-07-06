import type { AbstractIntlMessages } from "next-intl"

const DEDICATED_SHOP_BASE_KEYS = [
  "storefront",
  "boutique",
  "shops",
  "discovery",
  "cart",
  "errors",
  "auth",
] as const

const DEDICATED_SHOP_PDP_KEYS = [
  "Product",
  "product",
  "wishlist",
  "Breadcrumb",
  "checkout",
  "reviews",
  "marketplace",
] as const

const DEDICATED_SUPPLIER_KEYS = ["errors"] as const

function omitStorefrontBrandStudio(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const { brandStudio: _omit, ...buyerFacing } = value as Record<string, unknown>
  return buyerFacing
}

/** Pick top-level namespaces for `NextIntlClientProvider` (server bundle stays full). */
export function pickClientMessages(
  full: AbstractIntlMessages,
  topLevelKeys: readonly string[]
): AbstractIntlMessages {
  const out: AbstractIntlMessages = {}
  for (const key of topLevelKeys) {
    const value = full[key]
    if (value === undefined) continue
    out[key] = (
      key === "storefront" ? omitStorefrontBrandStudio(value) : value
    ) as AbstractIntlMessages[string]
  }
  return out
}

function isDedicatedShopPdpPath(pathname: string): boolean {
  return /^\/shops\/[^/]+\/product\/[^/]+/.test(pathname)
}

function isDedicatedSupplierPath(pathname: string): boolean {
  return /^\/store\/supplier\/[^/]+/.test(pathname)
}

/** Slim client i18n on custom-domain storefronts — ~80% smaller RSC payload vs full bundle. */
export function slimClientMessagesForDedicatedStorefront(
  full: AbstractIntlMessages,
  pathname: string
): AbstractIntlMessages {
  const path = pathname.split("?")[0]?.trim() || "/"

  if (isDedicatedSupplierPath(path)) {
    return pickClientMessages(full, DEDICATED_SUPPLIER_KEYS)
  }

  const keys = isDedicatedShopPdpPath(path)
    ? [...DEDICATED_SHOP_BASE_KEYS, ...DEDICATED_SHOP_PDP_KEYS]
    : [...DEDICATED_SHOP_BASE_KEYS]

  return pickClientMessages(full, keys)
}
