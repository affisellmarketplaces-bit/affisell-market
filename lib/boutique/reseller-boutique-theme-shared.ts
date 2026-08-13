/** Reseller boutique visual tokens — safe for `"use client"` (no Prisma). */

import {
  DEFAULT_STOREFRONT_THEME,
  parseStorefrontTheme,
  type StorefrontSurface,
  type StorefrontTheme,
} from "@/lib/storefront-theme-shared"

export type ResellerBoutiqueThemeProps = {
  primary: string
  accent: string
  surface: StorefrontSurface
  presetId: string | null
}

export type ResellerBoutiqueThemeCssVars = {
  pageBg: string
  pageText: string
  headerBg: string
  headerBorder: string
  headerMuted: string
  heroAccent: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  cardBg: string
  cardBorder: string
  cardTitle: string
  cardMuted: string
  cardImageBg: string
  priceGradient: string
  buttonGradient: string
  buttonShadow: string
  glowPrimary: string
  glowAccent: string
  poweredByBg: string
  poweredByBorder: string
  poweredByText: string
  footerText: string
  footerLink: string
  isDark: boolean
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase().replace(/^#/, "")
  if (!/^[0-9a-f]{6}$/.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(124, 58, 237, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function mixHex(a: string, b: string, ratio: number): string {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  if (!left || !right) return a
  const t = Math.min(1, Math.max(0, ratio))
  const r = Math.round(left.r + (right.r - left.r) * t)
  const g = Math.round(left.g + (right.g - left.g) * t)
  const bl = Math.round(left.b + (right.b - left.b) * t)
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

export function serializeResellerBoutiqueTheme(theme: StorefrontTheme): ResellerBoutiqueThemeProps {
  const parsed = parseStorefrontTheme(theme)
  return {
    primary: parsed.primary ?? DEFAULT_STOREFRONT_THEME.primary!,
    accent: parsed.accent ?? DEFAULT_STOREFRONT_THEME.accent!,
    surface: parsed.surface ?? DEFAULT_STOREFRONT_THEME.surface!,
    presetId: parsed.presetId ?? null,
  }
}

export function resolveResellerBoutiqueThemeCssVars(
  props: ResellerBoutiqueThemeProps
): ResellerBoutiqueThemeCssVars {
  const { primary, accent, surface } = props
  const mid = mixHex(primary, accent, 0.42)

  if (surface === "dark") {
    return {
      pageBg: `radial-gradient(ellipse 120% 80% at 10% 90%, ${primary} 0%, transparent 55%), radial-gradient(ellipse 90% 70% at 90% 10%, ${accent} 0%, transparent 50%), linear-gradient(145deg, ${primary} 0%, ${mid} 42%, ${accent} 100%)`,
      pageText: "#f4f4f5",
      headerBg: "rgba(9, 9, 11, 0.28)",
      headerBorder: "rgba(255, 255, 255, 0.14)",
      headerMuted: accent,
      heroAccent: accent,
      badgeBg: "rgba(255, 255, 255, 0.12)",
      badgeText: "#fafafa",
      badgeBorder: "rgba(255, 255, 255, 0.18)",
      cardBg: "#ffffff",
      cardBorder: "rgba(255, 255, 255, 0.2)",
      cardTitle: "#18181b",
      cardMuted: "#71717a",
      cardImageBg: `linear-gradient(135deg, ${withAlpha(primary, 0.08)} 0%, ${withAlpha(accent, 0.1)} 100%)`,
      priceGradient: `linear-gradient(90deg, ${primary}, ${accent})`,
      buttonGradient: `linear-gradient(90deg, ${primary}, ${accent})`,
      buttonShadow: `0 16px 40px -16px ${withAlpha(primary, 0.55)}`,
      glowPrimary: withAlpha(primary, 0.38),
      glowAccent: withAlpha(accent, 0.32),
      poweredByBg: "rgba(255, 255, 255, 0.1)",
      poweredByBorder: "rgba(255, 255, 255, 0.18)",
      poweredByText: "#fafafa",
      footerText: "rgba(250, 250, 250, 0.65)",
      footerLink: accent,
      isDark: true,
    }
  }

  if (surface === "glass") {
    return {
      pageBg: `linear-gradient(160deg, ${withAlpha(primary, 0.14)} 0%, #faf8ff 35%, ${withAlpha(accent, 0.16)} 100%)`,
      pageText: "#18181b",
      headerBg: "rgba(255, 255, 255, 0.72)",
      headerBorder: withAlpha(primary, 0.18),
      headerMuted: primary,
      heroAccent: accent,
      badgeBg: withAlpha(primary, 0.1),
      badgeText: primary,
      badgeBorder: withAlpha(primary, 0.22),
      cardBg: "rgba(255, 255, 255, 0.88)",
      cardBorder: withAlpha(primary, 0.14),
      cardTitle: "#18181b",
      cardMuted: "#52525b",
      cardImageBg: `linear-gradient(135deg, ${withAlpha(primary, 0.1)} 0%, ${withAlpha(accent, 0.12)} 100%)`,
      priceGradient: `linear-gradient(90deg, ${primary}, ${accent})`,
      buttonGradient: `linear-gradient(90deg, ${primary}, ${accent})`,
      buttonShadow: `0 16px 40px -16px ${withAlpha(primary, 0.4)}`,
      glowPrimary: withAlpha(primary, 0.22),
      glowAccent: withAlpha(accent, 0.18),
      poweredByBg: "rgba(255, 255, 255, 0.9)",
      poweredByBorder: withAlpha(primary, 0.2),
      poweredByText: primary,
      footerText: "#71717a",
      footerLink: primary,
      isDark: false,
    }
  }

  return {
    pageBg: `linear-gradient(180deg, ${withAlpha(primary, 0.08)} 0%, #faf8ff 42%, ${withAlpha(accent, 0.08)} 100%)`,
    pageText: "#18181b",
    headerBg: "rgba(255, 255, 255, 0.78)",
    headerBorder: withAlpha(primary, 0.14),
    headerMuted: primary,
    heroAccent: accent,
    badgeBg: withAlpha(primary, 0.08),
    badgeText: primary,
    badgeBorder: withAlpha(primary, 0.2),
    cardBg: "rgba(255, 255, 255, 0.92)",
    cardBorder: withAlpha(primary, 0.12),
    cardTitle: "#18181b",
    cardMuted: "#52525b",
    cardImageBg: `linear-gradient(135deg, ${withAlpha(primary, 0.08)} 0%, ${withAlpha(accent, 0.1)} 100%)`,
    priceGradient: `linear-gradient(90deg, ${primary}, ${accent})`,
    buttonGradient: `linear-gradient(90deg, ${primary}, ${accent})`,
    buttonShadow: `0 16px 40px -16px ${withAlpha(primary, 0.35)}`,
    glowPrimary: withAlpha(primary, 0.18),
    glowAccent: withAlpha(accent, 0.14),
    poweredByBg: "rgba(255, 255, 255, 0.92)",
    poweredByBorder: withAlpha(primary, 0.2),
    poweredByText: primary,
    footerText: "#71717a",
    footerLink: primary,
    isDark: false,
  }
}

export function boutiqueThemeToCssVarRecord(vars: ResellerBoutiqueThemeCssVars): Record<string, string> {
  return {
    "--boutique-page-bg": vars.pageBg,
    "--boutique-page-text": vars.pageText,
    "--boutique-header-bg": vars.headerBg,
    "--boutique-header-border": vars.headerBorder,
    "--boutique-header-muted": vars.headerMuted,
    "--boutique-hero-accent": vars.heroAccent,
    "--boutique-badge-bg": vars.badgeBg,
    "--boutique-badge-text": vars.badgeText,
    "--boutique-badge-border": vars.badgeBorder,
    "--boutique-card-bg": vars.cardBg,
    "--boutique-card-border": vars.cardBorder,
    "--boutique-card-title": vars.cardTitle,
    "--boutique-card-muted": vars.cardMuted,
    "--boutique-card-image-bg": vars.cardImageBg,
    "--boutique-price-gradient": vars.priceGradient,
    "--boutique-button-gradient": vars.buttonGradient,
    "--boutique-button-shadow": vars.buttonShadow,
    "--boutique-glow-primary": vars.glowPrimary,
    "--boutique-glow-accent": vars.glowAccent,
    "--boutique-powered-bg": vars.poweredByBg,
    "--boutique-powered-border": vars.poweredByBorder,
    "--boutique-powered-text": vars.poweredByText,
    "--boutique-footer-text": vars.footerText,
    "--boutique-footer-link": vars.footerLink,
  }
}
