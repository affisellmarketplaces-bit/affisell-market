"use client"

import type { ReactNode } from "react"

import { BoutiqueProceduralCanvas } from "@/components/boutique/boutique-procedural-canvas"
import { ResellerBoutiqueThemeVars } from "@/components/boutique/reseller-boutique-theme-vars"
import { getStorefrontThemeById } from "@/lib/boutique/storefront-theme-engine"

type Props = {
  themeId: string
  children: ReactNode
}

/** Buyer `/shops/` body — procedural boutique skin saved from design studio. */
export function ShopBoutiqueVisualShell({ themeId, children }: Props) {
  const theme = getStorefrontThemeById(themeId)

  return (
    <ResellerBoutiqueThemeVars theme={theme}>
      <BoutiqueProceduralCanvas className="relative min-h-[40vh] w-full overflow-hidden">
        {children}
      </BoutiqueProceduralCanvas>
    </ResellerBoutiqueThemeVars>
  )
}
