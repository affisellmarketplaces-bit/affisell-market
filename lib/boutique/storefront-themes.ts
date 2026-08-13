/** Client-safe visual skins for /boutique reseller storefronts (no Prisma). */

export type StorefrontThemeId =
  | "dark-futuristic"
  | "light-minimal"
  | "luxury-obsidian"
  | "neon-cyber"

/** Alias used in boutique UI components. */
export type StorefrontTheme = StorefrontThemeId

export const DEFAULT_STOREFRONT_THEME_ID: StorefrontThemeId = "dark-futuristic"

export const STOREFRONT_THEME_IDS: StorefrontThemeId[] = [
  "dark-futuristic",
  "light-minimal",
  "luxury-obsidian",
  "neon-cyber",
]

export type StorefrontThemeTokens = {
  label: string
  previewBg: string
  previewAccent: string
  shellBg: string
  shellOverlay: string
  blob1: string
  blob2: string
  gridClass: string
  cardClass: string
  buttonClass: string
  card: string
  cardImageBg: string
  cardTitle: string
  cardMuted: string
  price: string
  headerTitleGradient: string
  headerMuted: string
  badge: string
  footer: string
  cta: string
  avatar: string
  aiButton: string
  regenerateButton: string
}

export const STOREFRONT_THEMES: Record<StorefrontThemeId, StorefrontThemeTokens> = {
  "dark-futuristic": {
    label: "Dark Futuristic",
    previewBg: "#0a0a0f",
    previewAccent: "linear-gradient(135deg,#7c3aed,#14b8a6)",
    shellBg: "bg-[#0a0a0f]",
    shellOverlay: "from-[#1a0b3d] via-[#0a0a0f] to-[#0f766e]",
    blob1: "from-violet-600/30 to-indigo-600/30",
    blob2: "from-teal-400/20 to-cyan-400/20",
    gridClass: "w-full",
    cardClass:
      "bg-white/[0.95] border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl",
    buttonClass: "from-violet-600 to-teal-500 hover:from-violet-700 hover:to-teal-600",
    card: "bg-white/[0.95] border-white/50",
    cardImageBg: "bg-gray-50",
    cardTitle: "text-gray-900",
    cardMuted: "text-gray-500",
    price: "text-gray-900",
    headerTitleGradient: "from-white to-violet-200",
    headerMuted: "text-white/60",
    badge: "border-white/20 bg-white/10 text-white/70",
    footer: "border-white/10 text-white/40",
    cta: "from-violet-600 to-teal-500 hover:from-violet-700 hover:to-teal-600",
    avatar: "from-violet-500 to-teal-500 ring-white/20",
    aiButton:
      "border-white/10 bg-black text-white shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(109,40,217,0.5)]",
    regenerateButton: "border-white/20 bg-white/10 text-white hover:bg-white/20",
  },
  "light-minimal": {
    label: "Light Minimal",
    previewBg: "#fafaf9",
    previewAccent: "linear-gradient(135deg,#fb923c,#f472b6)",
    shellBg: "bg-[#fafaf9]",
    shellOverlay: "from-orange-50/80 via-[#fafaf9] to-violet-50/60",
    blob1: "from-orange-200/40 to-pink-200/40",
    blob2: "from-blue-200/30 to-violet-200/30",
    gridClass: "w-full",
    cardClass: "bg-white border-gray-200 shadow-sm",
    buttonClass: "from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600",
    card: "bg-white border-stone-200/80",
    cardImageBg: "bg-stone-50",
    cardTitle: "text-gray-900",
    cardMuted: "text-gray-500",
    price: "text-black",
    headerTitleGradient: "from-gray-900 to-violet-700",
    headerMuted: "text-gray-600",
    badge: "border-stone-200 bg-white text-gray-600 shadow-sm",
    footer: "border-stone-200 text-gray-400",
    cta: "from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600",
    avatar: "from-orange-400 to-pink-500 ring-stone-200",
    aiButton:
      "border-stone-200 bg-white text-gray-900 shadow-sm hover:bg-gray-900 hover:text-white",
    regenerateButton: "border-stone-200 bg-white/80 text-gray-700 hover:bg-white",
  },
  "luxury-obsidian": {
    label: "Luxury Obsidian",
    previewBg: "#000000",
    previewAccent: "linear-gradient(135deg,#f59e0b,#78716c)",
    shellBg: "bg-black",
    shellOverlay: "from-zinc-950 via-black to-zinc-900",
    blob1: "from-amber-500/10 to-yellow-500/10",
    blob2: "from-zinc-700/20 to-zinc-900/20",
    gridClass: "w-full",
    cardClass: "bg-zinc-900 border-zinc-800 text-white shadow-xl shadow-black/40",
    buttonClass: "from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700",
    card: "bg-zinc-900 border-zinc-800",
    cardImageBg: "bg-zinc-950",
    cardTitle: "text-white",
    cardMuted: "text-zinc-400",
    price: "text-white",
    headerTitleGradient: "from-amber-100 to-amber-400",
    headerMuted: "text-zinc-400",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    footer: "border-zinc-800 text-zinc-500",
    cta: "from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700",
    avatar: "from-amber-500 to-yellow-600 ring-amber-500/30",
    aiButton:
      "border-zinc-700 bg-zinc-950 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:bg-amber-500 hover:text-black",
    regenerateButton: "border-zinc-700 bg-zinc-900 text-amber-100 hover:bg-zinc-800",
  },
  "neon-cyber": {
    label: "Neon Cyber",
    previewBg: "#050507",
    previewAccent: "linear-gradient(135deg,#d946ef,#22d3ee)",
    shellBg: "bg-[#050507]",
    shellOverlay: "from-fuchsia-950/40 via-[#050507] to-cyan-950/30",
    blob1: "from-fuchsia-600/25 to-cyan-400/25",
    blob2: "from-lime-400/15 to-emerald-400/15",
    gridClass: "w-full",
    cardClass:
      "bg-white/[0.92] border-fuchsia-500/30 shadow-[0_0_24px_rgba(217,70,239,0.12)] backdrop-blur-xl",
    buttonClass: "from-fuchsia-600 to-cyan-500 hover:from-fuchsia-700 hover:to-cyan-600",
    card: "bg-white/[0.92] border-fuchsia-500/20",
    cardImageBg: "bg-zinc-950",
    cardTitle: "text-gray-900",
    cardMuted: "text-gray-500",
    price: "text-gray-900",
    headerTitleGradient: "from-fuchsia-200 to-cyan-200",
    headerMuted: "text-fuchsia-200/70",
    badge: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100",
    footer: "border-fuchsia-500/20 text-fuchsia-200/40",
    cta: "from-fuchsia-600 to-cyan-500 hover:from-fuchsia-700 hover:to-cyan-600",
    avatar: "from-fuchsia-500 to-cyan-400 ring-fuchsia-400/30",
    aiButton:
      "border-fuchsia-500/30 bg-black text-fuchsia-100 shadow-[0_0_20px_rgba(217,70,239,0.25)] hover:bg-fuchsia-500 hover:text-black",
    regenerateButton: "border-fuchsia-500/25 bg-white/5 text-fuchsia-100 hover:bg-white/10",
  },
}

export function parseStorefrontThemeId(raw: string | null | undefined): StorefrontThemeId | null {
  if (!raw?.trim()) return null
  const id = raw.trim() as StorefrontThemeId
  return STOREFRONT_THEME_IDS.includes(id) ? id : null
}

export function getStorefrontThemeTokens(themeId: StorefrontThemeId): StorefrontThemeTokens {
  return STOREFRONT_THEMES[themeId]
}

export function nextStorefrontThemeId(current: StorefrontThemeId): StorefrontThemeId {
  const index = STOREFRONT_THEME_IDS.indexOf(current)
  const next = (index + 1) % STOREFRONT_THEME_IDS.length
  return STOREFRONT_THEME_IDS[next] ?? DEFAULT_STOREFRONT_THEME_ID
}

export function storefrontThemeStorageKey(storeSlug: string): string {
  return `affisell:store-theme:${storeSlug}`
}

export function readStoredStorefrontTheme(storeSlug: string): StorefrontThemeId | null {
  if (typeof window === "undefined") return null
  try {
    return parseStorefrontThemeId(window.localStorage.getItem(storefrontThemeStorageKey(storeSlug)))
  } catch {
    return null
  }
}

export function writeStoredStorefrontTheme(storeSlug: string, themeId: StorefrontThemeId): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storefrontThemeStorageKey(storeSlug), themeId)
  } catch {
    /* ignore quota / private mode */
  }
}
