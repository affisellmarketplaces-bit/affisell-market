"use client"

import { useCallback, useEffect, useState } from "react"

import { ResellerBoutiquePageShell } from "@/components/boutique/reseller-boutique-page-shell"
import { ResellerStorefrontGrid } from "@/components/boutique/ResellerStorefrontGrid"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  readStoredStorefrontTheme,
  type StorefrontThemeId,
  writeStoredStorefrontTheme,
} from "@/lib/boutique/storefront-themes"

type Props = {
  storeSlug: string
  storeLabel: string
  tagline?: string | null
  brandTheme: ResellerBoutiqueThemeProps
  initialVisualTheme: StorefrontThemeId
  products: ResellerStorefrontListProduct[]
  count: number
}

export function ResellerStorefrontView({
  storeSlug,
  storeLabel,
  tagline,
  brandTheme,
  initialVisualTheme,
  products,
  count,
}: Props) {
  const [visualTheme, setVisualTheme] = useState<StorefrontThemeId>(initialVisualTheme)

  useEffect(() => {
    const stored = readStoredStorefrontTheme(storeSlug)
    if (stored) {
      setVisualTheme(stored)
      return
    }
    setVisualTheme(initialVisualTheme)
  }, [initialVisualTheme, storeSlug])

  const handleVisualThemeChange = useCallback(
    (themeId: StorefrontThemeId) => {
      setVisualTheme(themeId)
      writeStoredStorefrontTheme(storeSlug, themeId)

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href)
        url.searchParams.set("theme", themeId)
        window.history.replaceState(null, "", url.toString())
      }
    },
    [storeSlug]
  )

  return (
    <ResellerBoutiquePageShell themeId={visualTheme}>
      <ResellerStorefrontGrid
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        tagline={tagline}
        brandTheme={brandTheme}
        visualTheme={visualTheme}
        onVisualThemeChange={handleVisualThemeChange}
        products={products}
        count={count}
      />
    </ResellerBoutiquePageShell>
  )
}

export { DEFAULT_STOREFRONT_THEME_ID }
