import { StorefrontBuyerChrome } from "@/components/storefront/storefront-buyer-chrome"
import { StorefrontDedicatedHero } from "@/components/storefront/storefront-dedicated-hero"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { buildResellerBoutiquePath } from "@/lib/boutique/reseller-store-slug"
import type { ResellerBoutiqueStoreContext } from "@/lib/boutique/load-reseller-storefront.server"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"

/**
 * Buyer chrome aligned with `/shops/` — sticky header + trust rail + Brand Studio hero (Veo/banner).
 * Procedural boutique grid renders below inside `ResellerBoutiquePageShell`.
 */
export function buildResellerBoutiqueStorefrontChrome(
  storeContext: ResellerBoutiqueStoreContext,
  trust: StorefrontTrustSnapshot | null
) {
  const theme = storeContext.brandStudioTheme
  const boutiqueHome = buildResellerBoutiquePath(storeContext.storeSlug)
  const heroDescription =
    storeContext.tagline?.trim() ||
    storeContext.description?.trim() ||
    null

  return (
    <div className="affisell-boutique-storefront-chrome relative z-[120] w-full">
      <StorefrontThemeStyles theme={theme} />
      <StorefrontBuyerChrome
        storeName={storeContext.storeName}
        logoUrl={storeContext.logoUrl ?? storeContext.aiAvatarUrl}
        accent={theme.accent}
        primary={theme.primary}
        trustRailText={theme.trustRailText}
        nameBadge={theme.nameBadge}
        headerBrandAlign={theme.headerBrandAlign}
        categoriesSlug={storeContext.storeSlug}
        shopHomePath={boutiqueHome}
        trust={trust}
      />
      <StorefrontDedicatedHero
        description={heroDescription}
        bannerUrl={storeContext.bannerUrl}
        theme={theme}
        brandAlign={theme.headerBrandAlign}
      />
    </div>
  )
}
