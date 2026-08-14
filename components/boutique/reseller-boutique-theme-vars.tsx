"use client"

import type { CSSProperties, ReactNode } from "react"

import type { StorefrontThemeDefinition } from "@/lib/boutique/storefront-theme-engine"

type Props = {
  theme: StorefrontThemeDefinition
  children: ReactNode
}

export function boutiqueThemeStyle(theme: StorefrontThemeDefinition): CSSProperties {
  const v = theme.cssVars
  return {
    ["--boutique-shell-bg" as string]: v.shellBg,
    ["--boutique-gradient-from" as string]: v.shellGradientFrom,
    ["--boutique-gradient-via" as string]: v.shellGradientVia,
    ["--boutique-gradient-to" as string]: v.shellGradientTo,
    ["--boutique-blob-1" as string]: v.blob1,
    ["--boutique-blob-2" as string]: v.blob2,
    ["--boutique-blob-3" as string]: v.blob3,
    ["--boutique-accent" as string]: v.accent,
    ["--boutique-accent-soft" as string]: v.accentSoft,
    ["--boutique-card-bg" as string]: v.cardBg,
    ["--boutique-card-border" as string]: v.cardBorder,
    ["--boutique-card-shadow" as string]: v.cardShadow,
    ["--boutique-card-title" as string]: v.cardTitle,
    ["--boutique-card-muted" as string]: v.cardMuted,
    ["--boutique-price" as string]: v.price,
    ["--boutique-header-word" as string]: v.headerWord,
    ["--boutique-header-accent-from" as string]: v.headerAccentFrom,
    ["--boutique-header-accent-to" as string]: v.headerAccentTo,
    ["--boutique-header-muted" as string]: v.headerMuted,
    ["--boutique-badge-bg" as string]: v.badgeBg,
    ["--boutique-badge-border" as string]: v.badgeBorder,
    ["--boutique-badge-text" as string]: v.badgeText,
    ["--boutique-button-from" as string]: v.buttonFrom,
    ["--boutique-button-to" as string]: v.buttonTo,
    ["--boutique-button-shadow" as string]: v.buttonShadow,
    ["--boutique-footer-border" as string]: v.footerBorder,
    ["--boutique-footer-text" as string]: v.footerText,
    ["--boutique-ai-bg" as string]: v.aiButtonBg,
    ["--boutique-ai-border" as string]: v.aiButtonBorder,
    ["--boutique-ai-text" as string]: v.aiButtonText,
    ["--boutique-regen-bg" as string]: v.regenerateBg,
    ["--boutique-regen-border" as string]: v.regenerateBorder,
    ["--boutique-regen-text" as string]: v.regenerateText,
    ["--boutique-merchant-header-from" as string]: v.merchantHeaderFrom,
    ["--boutique-merchant-header-via" as string]: v.merchantHeaderVia,
    ["--boutique-merchant-header-to" as string]: v.merchantHeaderTo,
    ["--boutique-merchant-header-border" as string]: v.merchantHeaderBorder,
    ["--boutique-merchant-header-glow" as string]: v.merchantHeaderGlow,
    ["--boutique-merchant-header-badge-border" as string]: v.merchantHeaderBadgeBorder,
    ["--boutique-merchant-header-badge-icon" as string]: v.merchantHeaderBadgeIcon,
    ["--boutique-merchant-header-active" as string]: v.merchantHeaderActive,
    ["--boutique-merchant-header-active-glow" as string]: v.merchantHeaderActiveGlow,
    ["--boutique-merchant-header-cart-badge" as string]: v.merchantHeaderCartBadge,
    ["--boutique-merchant-header-cart-badge-text" as string]: v.merchantHeaderCartBadgeText,
    ["--boutique-merchant-header-logo-from" as string]: v.merchantHeaderLogoFrom,
    ["--boutique-merchant-header-logo-to" as string]: v.merchantHeaderLogoTo,
    ["--boutique-merchant-header-logo-top" as string]: v.merchantHeaderLogoTop,
    ["--boutique-merchant-header-logo-bottom" as string]: v.merchantHeaderLogoBottom,
    ["--boutique-merchant-header-shadow" as string]: v.merchantHeaderShadow,
    backgroundColor: v.shellBg,
  }
}

export function ResellerBoutiqueThemeVars({ theme, children }: Props) {
  return (
    <div className="boutique-theme-root transition-[background-color] duration-700 ease-in-out" style={boutiqueThemeStyle(theme)}>
      {children}
    </div>
  )
}
