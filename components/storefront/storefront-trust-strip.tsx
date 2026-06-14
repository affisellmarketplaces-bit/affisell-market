"use client"

import { StorefrontHeaderTrustRail } from "@/components/storefront/storefront-header-trust-rail"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  trust: StorefrontTrustSnapshot
  isCustomDomain?: boolean
  theme?: StorefrontTheme
  className?: string
}

/** Standalone trust band (platform preview `/shops/:slug`). Dedicated domains use the integrated header rail. */
export function StorefrontTrustStrip({ trust, isCustomDomain = false, theme, className }: Props) {
  return (
    <StorefrontHeaderTrustRail
      trust={trust}
      accent={theme?.accent ?? "#7c3aed"}
      isCustomDomain={isCustomDomain}
      variant="standalone"
      className={cn(className)}
    />
  )
}
