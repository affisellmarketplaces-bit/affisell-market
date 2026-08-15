"use client"

import type { CSSProperties, ReactNode } from "react"

import { boutiqueThemeStyle } from "@/components/boutique/reseller-boutique-theme-vars"
import type { BrandStudioSnapshot } from "@/lib/boutique/haute-gamme-themes-shared"
import { brandStudioToThemeDefinition } from "@/lib/boutique/haute-gamme-themes-shared"
import { getStorefrontThemeById } from "@/lib/boutique/storefront-theme-engine"

type Props = {
  themeId: string
  brandStudio?: BrandStudioSnapshot | null
  header?: ReactNode
  children: ReactNode
}

function mergeThemeStyle(
  base: CSSProperties,
  overrides: CSSProperties
): CSSProperties {
  return { ...base, ...overrides }
}

/** One themed canvas — merchant nav + boutique body share the same procedural skin. */
export function ResellerBoutiquePageShell({ themeId, brandStudio, header, children }: Props) {
  const proceduralTheme = getStorefrontThemeById(themeId)
  const theme = brandStudio ? brandStudioToThemeDefinition(brandStudio) : proceduralTheme
  const style = mergeThemeStyle(boutiqueThemeStyle(theme), {})

  return (
    <div
      className="boutique-theme-root transition-[background-color] duration-700 ease-in-out"
      data-boutique-theme-mode={theme.isDark ? "dark" : "light"}
      data-haute-gamme={brandStudio ? brandStudio.designId : undefined}
      style={style}
    >
      <div className="relative min-h-screen w-full overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-all duration-700 ease-in-out"
          style={{
            background: `linear-gradient(135deg, var(--boutique-gradient-from) 0%, var(--boutique-gradient-via) 45%, var(--boutique-gradient-to) 100%)`,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-32 -top-24 z-0 h-[32rem] w-[32rem] rounded-full blur-3xl transition-all duration-700 ease-in-out"
          style={{ background: "var(--boutique-blob-1)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-32 z-0 h-[36rem] w-[36rem] rounded-full blur-3xl transition-all duration-700 ease-in-out"
          style={{ background: "var(--boutique-blob-2)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 z-0 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl transition-all duration-700 ease-in-out"
          style={{ background: "var(--boutique-blob-3)" }}
          aria-hidden
        />

        <div className="relative z-10">
          {header}
          <div className="mx-auto w-full max-w-[1600px] px-6 py-10 md:px-8 lg:px-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
