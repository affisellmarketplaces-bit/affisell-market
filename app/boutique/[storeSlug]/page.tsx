import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { auth } from "@/auth"
import { buildResellerBoutiqueHeader } from "@/components/boutique/build-reseller-boutique-header"

import {
  loadResellerBoutiqueProductDetail,
  loadResellerBoutiqueStoreContext,
  loadResellerStorefrontList,
} from "@/lib/boutique/load-reseller-storefront.server"
import { serializeResellerBoutiqueTheme } from "@/lib/boutique/reseller-boutique-theme-shared"
import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"
import {
  DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  parseBoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  parseStorefrontThemeId,
} from "@/lib/boutique/storefront-themes"
import { resolveBoutiqueVisitorVisualTheme } from "@/lib/boutique/boutique-affisell-chrome-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { loadAffiliateStorefrontTrustCached } from "@/lib/shop-storefront-cache"

import { ResellerBoutiquePageShell } from "@/components/boutique/reseller-boutique-page-shell"
import { ResellerStorefrontEmptyState } from "@/components/boutique/ResellerStorefrontEmptyState"
import { ResellerStorefrontView } from "@/components/boutique/ResellerStorefrontView"
import { ResellerStorefrontShell } from "@/components/boutique/ResellerStorefrontShell"

export const revalidate = 60

type PageProps = {
  params: Promise<{ storeSlug: string }>
  searchParams: Promise<{ productId?: string; theme?: string; vibe?: string }>
}

const defaultTheme = serializeResellerBoutiqueTheme(parseStorefrontTheme(null))

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const storeContext = await loadResellerBoutiqueStoreContext(storeSlug)
  const label = storeContext?.storeLabel ?? formatResellerStoreLabel(storeSlug)
  const listingId = sp.productId?.trim() || null
  const product = listingId ? await loadResellerBoutiqueProductDetail(listingId) : null

  if (product) {
    return {
      title: `${product.title} | ${label}`,
      description: product.descriptionExcerpt || `Achetez ${product.title} sur la boutique ${label}.`,
      openGraph: {
        title: `${product.title} · ${label}`,
        description: product.descriptionExcerpt,
        images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
      },
    }
  }

  const storefront = listingId ? null : await loadResellerStorefrontList({ storeSlug })
  const productCount = storefront?.count ?? 0

  return {
    title: `${label} | Boutique Affisell`,
    description:
      productCount > 0
        ? `Découvrez ${productCount} produit${productCount > 1 ? "s" : ""} sur la boutique reseller ${label}.`
        : `Découvrez la boutique reseller ${label} propulsée par Affisell.`,
  }
}

export default async function ResellerBoutiquePage({ params, searchParams }: PageProps) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const requestedListingId = sp.productId?.trim() || null

  const [storeContext, session, trust] = await Promise.all([
    loadResellerBoutiqueStoreContext(storeSlug),
    auth(),
    loadAffiliateStorefrontTrustCached(storeSlug),
  ])
  const storeLabel = storeContext?.storeLabel ?? formatResellerStoreLabel(storeSlug)
  const theme = storeContext?.theme ?? defaultTheme
  const viewerIsOwner = Boolean(
    session?.user?.id && storeContext?.ownerUserId === session.user.id
  )
  const savedVisualTheme =
    parseStorefrontThemeId(storeContext?.boutiqueVisualTheme ?? null) ?? DEFAULT_STOREFRONT_THEME_ID
  const boutiqueHeader =
    storeContext != null ? buildResellerBoutiqueHeader(storeContext, session, trust) : null

  if (requestedListingId) {
    const product = await loadResellerBoutiqueProductDetail(requestedListingId)
    return (
      <ResellerStorefrontShell
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        theme={theme}
        product={product}
        requestedListingId={requestedListingId}
        header={boutiqueHeader}
        visualThemeId={savedVisualTheme}
      />
    )
  }

  const storefront = await loadResellerStorefrontList({ storeSlug })
  const resolvedTheme = storefront.theme ?? theme
  const visitorVisualTheme = resolveBoutiqueVisitorVisualTheme({
    persistedThemeId: savedVisualTheme,
    requestedThemeId: sp.theme,
    viewerIsOwner,
  })
  const t = await getTranslations("boutique.productCard")
  const productCardTrustLine = t("trustLine")

  if (storefront.count === 0) {
    return (
      <ResellerBoutiquePageShell themeId={visitorVisualTheme} header={boutiqueHeader}>
        <ResellerStorefrontEmptyState
          storeSlug={storeSlug}
          storeLabel={storeLabel}
          theme={resolvedTheme}
        />
      </ResellerBoutiquePageShell>
    )
  }

  return (
    <Suspense fallback={null}>
      <ResellerStorefrontView
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        tagline={storeContext?.tagline ?? null}
        brandTheme={resolvedTheme}
        initialVisualTheme={visitorVisualTheme}
        persistedVisualTheme={savedVisualTheme}
        viewerIsOwner={viewerIsOwner}
        titleTypography={storeContext?.titleTypography ?? DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY}
        persistedTitleTypography={storeContext?.titleTypography ?? DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY}
        productCardTrustLine={productCardTrustLine}
        products={storefront.products}
        count={storefront.count}
        header={boutiqueHeader}
        brandStudio={storeContext?.brandStudio ?? null}
        brandStudioHref="/dashboard/affiliate/brand-studio"
      />
    </Suspense>
  )
}
