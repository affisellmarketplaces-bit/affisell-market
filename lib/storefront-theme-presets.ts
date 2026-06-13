import type { StorefrontTheme } from "@/lib/storefront-theme-shared"

export type StorefrontThemePreset = {
  id: string
  theme: StorefrontTheme
}

export const STOREFRONT_THEME_PRESETS: StorefrontThemePreset[] = [
  {
    id: "violet-pulse",
    theme: {
      presetId: "violet-pulse",
      primary: "#0f0a1a",
      accent: "#8b5cf6",
      nameBadge: "neon-slab",
      layout: "immersive",
      heroStyle: "gradient",
      gridDensity: "cozy",
      surface: "dark",
    },
  },
  {
    id: "emerald-luxe",
    theme: {
      presetId: "emerald-luxe",
      primary: "#052e2b",
      accent: "#10b981",
      nameBadge: "chrome-beam",
      layout: "classic",
      heroStyle: "banner",
      gridDensity: "spacious",
      surface: "glass",
    },
  },
  {
    id: "midnight-orbit",
    theme: {
      presetId: "midnight-orbit",
      primary: "#09090b",
      accent: "#22d3ee",
      nameBadge: "orbit-ring",
      layout: "immersive",
      heroStyle: "gradient",
      gridDensity: "compact",
      surface: "dark",
    },
  },
  {
    id: "rose-editorial",
    theme: {
      presetId: "rose-editorial",
      primary: "#1c1917",
      accent: "#fb7185",
      nameBadge: "holo-ribbon",
      layout: "classic",
      heroStyle: "banner",
      gridDensity: "cozy",
      surface: "light",
    },
  },
  {
    id: "clean-minimal",
    theme: {
      presetId: "clean-minimal",
      primary: "#27272a",
      accent: "#52525b",
      nameBadge: "classic",
      layout: "minimal",
      heroStyle: "none",
      gridDensity: "spacious",
      surface: "light",
      headerBrandAlign: "center",
    },
  },
  {
    id: "quantum-glow",
    theme: {
      presetId: "quantum-glow",
      primary: "#1e1b4b",
      accent: "#a78bfa",
      nameBadge: "quantum-fold",
      layout: "classic",
      heroStyle: "gradient",
      gridDensity: "cozy",
      surface: "glass",
    },
  },
]

export function findStorefrontThemePreset(id: string): StorefrontThemePreset | undefined {
  return STOREFRONT_THEME_PRESETS.find((p) => p.id === id)
}
