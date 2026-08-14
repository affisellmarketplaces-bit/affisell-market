import type { StorefrontTheme } from "@/lib/boutique/storefront-themes"
import { parseStorefrontThemeId } from "@/lib/boutique/storefront-themes"

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
