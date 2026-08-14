import type { CSSProperties } from "react"

import type { StorefrontTheme } from "@/lib/boutique/storefront-themes"
import { parseStorefrontThemeId } from "@/lib/boutique/storefront-themes"

/** Fixed Affisell platform chrome for /boutique merchant nav — never follows reseller skin. */
export const AFFISELL_BOUTIQUE_CHROME = {
  merchantHeaderFrom: "#1a1f5c",
  merchantHeaderVia: "#312e81",
  merchantHeaderTo: "#0891b2",
  merchantHeaderBorder: "rgba(255,255,255,0.08)",
  merchantHeaderGlow: "rgba(34,211,238,0.22)",
  merchantHeaderBadgeBorder: "rgba(78,226,236,0.85)",
  merchantHeaderBadgeIcon: "#4ee2ec",
  merchantHeaderActive: "#22d3ee",
  merchantHeaderActiveGlow: "rgba(34,211,238,0.9)",
  merchantHeaderCartBadge: "#22d3ee",
  merchantHeaderCartBadgeText: "#1e1b4b",
  merchantHeaderLogoTop: "#4ee2ec",
  merchantHeaderLogoBottom: "#4a5ae8",
  merchantHeaderShadow: "0 18px 50px rgba(15,23,42,0.55)",
} as const

export function affisellBoutiqueChromeStyle(): CSSProperties {
  const c = AFFISELL_BOUTIQUE_CHROME
  return {
    ["--boutique-merchant-header-from" as string]: c.merchantHeaderFrom,
    ["--boutique-merchant-header-via" as string]: c.merchantHeaderVia,
    ["--boutique-merchant-header-to" as string]: c.merchantHeaderTo,
    ["--boutique-merchant-header-border" as string]: c.merchantHeaderBorder,
    ["--boutique-merchant-header-glow" as string]: c.merchantHeaderGlow,
    ["--boutique-merchant-header-badge-border" as string]: c.merchantHeaderBadgeBorder,
    ["--boutique-merchant-header-badge-icon" as string]: c.merchantHeaderBadgeIcon,
    ["--boutique-merchant-header-active" as string]: c.merchantHeaderActive,
    ["--boutique-merchant-header-active-glow" as string]: c.merchantHeaderActiveGlow,
    ["--boutique-merchant-header-cart-badge" as string]: c.merchantHeaderCartBadge,
    ["--boutique-merchant-header-cart-badge-text" as string]: c.merchantHeaderCartBadgeText,
    ["--boutique-merchant-header-logo-top" as string]: c.merchantHeaderLogoTop,
    ["--boutique-merchant-header-logo-bottom" as string]: c.merchantHeaderLogoBottom,
    ["--boutique-merchant-header-logo-from" as string]: c.merchantHeaderLogoBottom,
    ["--boutique-merchant-header-logo-to" as string]: c.merchantHeaderLogoTop,
    ["--boutique-merchant-header-shadow" as string]: c.merchantHeaderShadow,
  }
}

/** Buyers always see saved design; owners may preview via ?theme= or local draft. */
export function resolveBoutiqueVisitorVisualTheme(args: {
  persistedThemeId: StorefrontTheme
  requestedThemeId: string | null | undefined
  viewerIsOwner: boolean
}): StorefrontTheme {
  if (args.viewerIsOwner) {
    const preview = parseStorefrontThemeId(args.requestedThemeId ?? null)
    if (preview) return preview
  }
  return args.persistedThemeId
}
