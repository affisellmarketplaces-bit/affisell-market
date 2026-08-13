"use client"

import { cn } from "@/lib/utils"
import {
  getStorefrontThemeTokens,
  type StorefrontThemeId,
} from "@/lib/boutique/storefront-themes"
import type { ReactNode } from "react"

type Props = {
  themeId: StorefrontThemeId
  children: ReactNode
}

export function ResellerBoutiquePageShell({ themeId, children }: Props) {
  const tokens = getStorefrontThemeTokens(themeId)

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden transition-colors duration-700 ease-in-out",
        tokens.shellBg
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0 bg-gradient-to-br transition-opacity duration-700 ease-in-out",
          tokens.shellOverlay
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -left-40 -top-20 z-0 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br blur-3xl transition-all duration-700 ease-in-out",
          tokens.blob1
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-20 -right-40 z-0 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br blur-3xl transition-all duration-700 ease-in-out",
          tokens.blob2
        )}
        aria-hidden
      />
      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-6 py-10 md:px-8 lg:px-12">
        {children}
      </div>
    </div>
  )
}
