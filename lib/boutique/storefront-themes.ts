/**
 * Facade for boutique visual themes — procedural engine (1024 skins).
 */
export {
  buildStorefrontTheme,
  DEFAULT_STOREFRONT_THEME_ID,
  FEATURED_THEME_INDICES,
  getStorefrontThemeById,
  getStorefrontThemeByIndex,
  nextStorefrontThemeRef,
  parseStorefrontThemeRef,
  STOREFRONT_THEME_COUNT,
  storefrontThemeStorageKey,
  themeRefFromVibe,
  type StorefrontTheme,
  type StorefrontThemeCssVars,
  type StorefrontThemeDefinition,
} from "@/lib/boutique/storefront-theme-engine"

import {
  getStorefrontThemeById,
  nextStorefrontThemeRef,
  parseStorefrontThemeRef,
  storefrontThemeStorageKey,
  type StorefrontTheme,
} from "@/lib/boutique/storefront-theme-engine"

export function getStorefrontThemeTokens(themeId: StorefrontTheme) {
  return getStorefrontThemeById(themeId)
}

export function parseStorefrontThemeId(raw: string | null | undefined): StorefrontTheme | null {
  return parseStorefrontThemeRef(raw)
}

export function nextStorefrontThemeId(current: StorefrontTheme): StorefrontTheme {
  return nextStorefrontThemeRef(current)
}

export function readStoredStorefrontTheme(storeSlug: string): StorefrontTheme | null {
  if (typeof window === "undefined") return null
  try {
    return parseStorefrontThemeRef(window.localStorage.getItem(storefrontThemeStorageKey(storeSlug)))
  } catch {
    return null
  }
}

export function writeStoredStorefrontTheme(storeSlug: string, themeId: StorefrontTheme): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storefrontThemeStorageKey(storeSlug), themeId)
  } catch {
    /* ignore */
  }
}
