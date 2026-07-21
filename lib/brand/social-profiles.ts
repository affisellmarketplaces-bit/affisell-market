/**
 * Affisell Brand Hub — social profiles ready to connect (18 networks).
 * Client-safe.
 */

export type SocialTier = "must" | "growth" | "global"

export type SocialProfile = {
  id: string
  name: string
  handle: string
  /** Short bio / about / tagline depending on platform */
  bio: string
  /** Optional longer about (YouTube / LinkedIn) */
  about?: string
  tagline?: string
  link: string
  tier: SocialTier
  /** Locale hint for copy UX */
  locale: "FR" | "EN" | "ES" | "AR" | "JP" | "ZH" | "RU" | "KO"
  status: "ready"
}

export const BRAND = {
  mission: "Le Bloomberg Terminal du E-commerce pour sourcer en 1 clic",
  taglineFr: "Source comme un pro. Vends comme un boss.",
  taglineEn: "Source like a pro. Sell like a boss.",
  taglineGlobal: "World Radar - 31 Countries, 620 Winners, Daily",
  colors: {
    primary: "#6D28D9",
    bg: "#0A0A0B",
    fg: "#FFFFFF",
  },
  links: {
    home: "https://affisell.com",
    radar: "https://affisell.com/radar",
    brand: "https://affisell.com/brand",
  },
  hashtags: ["#ecommerce", "#dropshipping", "#sourcing", "#worldradar", "#affisell"],
  tone: "Pro, futuriste, Bloomberg — pas fun/dropshipping cheap",
} as const

export const BIOS = {
  short: {
    FR: "Le Bloomberg Terminal du E-commerce. World Radar: 31 pays, 620 winners. Source en 1 clic. affisell.com/radar",
    EN: "The Bloomberg Terminal for E-commerce. World Radar: 31 countries, 620 winners. Source in 1 click. affisell.com/radar",
    ES: "El Bloomberg Terminal del e-commerce. World Radar: 31 países, 620 winners. Source en 1 clic. affisell.com/radar",
    AR: "بلومبرغ تيرمينال للتجارة الإلكترونية. World Radar: 31 دولة و620 منتج رابح. affisell.com/radar",
    JP: "EコマースのBloomberg Terminal。World Radar：31カ国・620 winners。1クリックで仕入れ。affisell.com/radar",
  },
  long: {
    EN: "Affisell is the Bloomberg Terminal for E-commerce sourcing. World Radar scans 31 countries daily and surfaces 620 product winners so founders, affiliates, and suppliers can source in one click — cultural affinity, arbitrage scores, weekly challenger rotation. No cheap hype. A professional terminal for global commerce. affisell.com/radar",
    FR: "Affisell est le Bloomberg Terminal du e-commerce. World Radar analyse 31 pays chaque jour et surface 620 produits winners pour sourcer en 1 clic — affinité culturelle, scores d’arbitrage, rotation hebdomadaire. Pas de hype cheap. Un terminal pro pour le commerce mondial. affisell.com/radar",
  },
  platform: {
    instagram: "Le Bloomberg Terminal du E-commerce 🌍 31 pays | 620 winners | Source en 1 clic",
    tiktok: "World Radar: 31 pays, 620 produits winners/jour 🌍",
    x: "World Radar — 31 Countries. 620 Winners. Daily. The Bloomberg Terminal for E-commerce sourcing. affisell.com/radar",
    linkedinTagline: "The Sourcing OS - World Radar 31 Countries",
    youtubeAbout:
      "Affisell is the Bloomberg Terminal for E-commerce. World Radar covers 31 countries and 620 daily winners — source like a pro at affisell.com/radar",
    productHunt: "World Radar: 31 countries · 620 winners · daily sourcing terminal",
    facebook: "Affisell — World Radar. 31 countries. 620 winners. Source in 1 click.",
    threads: "Bloomberg Terminal for e-com. World Radar · 31 countries · affisell.com/radar",
    pinterest: "World Radar product winners · 31 countries · Affisell sourcing OS",
    reddit: "Affisell World Radar — 31 countries, 620 winners/day. Pro sourcing terminal.",
    indieHackers: "Building the Bloomberg Terminal for e-commerce sourcing · World Radar 31 countries",
    douyin: "World Radar 跨境选品 · 31国 · 每日620爆款 · Affisell",
    xiaohongshu: "Affisell World Radar｜31个国家｜每日620爆款选品｜一键开源",
    vk: "Affisell World Radar — 31 страны, 620 winners ежедневно. Терминал для e-commerce.",
    naver: "Affisell World Radar — 31개국 · 매일 620 위너 · 원클릭 소싱",
    line: "Affisell World Radar｜31カ国｜毎日620 winners｜プロの仕入れ",
    weibo: "Affisell World Radar：31国跨境选品，每日620爆款。专业终端，不是廉价铺货。",
    whatsapp: "Affisell World Radar — 31 pays, 620 winners/jour. affisell.com/radar",
    telegram: "Affisell · World Radar 31 countries · 620 winners/day · affisell.com/radar",
  },
} as const

export const SOCIAL_PROFILES: Record<string, SocialProfile> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    handle: "@affisell",
    bio: BIOS.platform.instagram,
    link: "https://instagram.com/affisell",
    tier: "must",
    locale: "FR",
    status: "ready",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    handle: "@affisell",
    bio: BIOS.platform.tiktok,
    link: "https://www.tiktok.com/@affisell",
    tier: "must",
    locale: "FR",
    status: "ready",
  },
  x: {
    id: "x",
    name: "X",
    handle: "@affisellcom",
    bio: BIOS.platform.x,
    link: "https://x.com/affisellcom",
    tier: "must",
    locale: "EN",
    status: "ready",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    handle: "Affisell",
    bio: BIOS.platform.linkedinTagline,
    tagline: BIOS.platform.linkedinTagline,
    about: BIOS.long.EN,
    link: "https://www.linkedin.com/company/affisell",
    tier: "must",
    locale: "EN",
    status: "ready",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    handle: "@Affisell",
    bio: BIOS.platform.youtubeAbout,
    about: BIOS.platform.youtubeAbout,
    link: "https://www.youtube.com/@Affisell",
    tier: "must",
    locale: "EN",
    status: "ready",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    handle: "@affisell",
    bio: BIOS.platform.facebook,
    link: "https://www.facebook.com/affisell",
    tier: "must",
    locale: "EN",
    status: "ready",
  },
  threads: {
    id: "threads",
    name: "Threads",
    handle: "@affisell",
    bio: BIOS.platform.threads,
    link: "https://www.threads.net/@affisell",
    tier: "growth",
    locale: "EN",
    status: "ready",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    handle: "@affisell",
    bio: BIOS.platform.pinterest,
    link: "https://www.pinterest.com/affisell",
    tier: "growth",
    locale: "EN",
    status: "ready",
  },
  reddit: {
    id: "reddit",
    name: "Reddit",
    handle: "u/affisell",
    bio: BIOS.platform.reddit,
    link: "https://www.reddit.com/user/affisell",
    tier: "growth",
    locale: "EN",
    status: "ready",
  },
  producthunt: {
    id: "producthunt",
    name: "Product Hunt",
    handle: "@affisell",
    bio: BIOS.platform.productHunt,
    tagline: BIOS.platform.productHunt,
    link: "https://www.producthunt.com/@affisell",
    tier: "growth",
    locale: "EN",
    status: "ready",
  },
  indiehackers: {
    id: "indiehackers",
    name: "Indie Hackers",
    handle: "@affisell",
    bio: BIOS.platform.indieHackers,
    link: "https://www.indiehackers.com/affisell",
    tier: "growth",
    locale: "EN",
    status: "ready",
  },
  douyin: {
    id: "douyin",
    name: "Douyin",
    handle: "@affisell",
    bio: BIOS.platform.douyin,
    link: "https://www.douyin.com",
    tier: "global",
    locale: "ZH",
    status: "ready",
  },
  xiaohongshu: {
    id: "xiaohongshu",
    name: "Xiaohongshu",
    handle: "@affisell",
    bio: BIOS.platform.xiaohongshu,
    link: "https://www.xiaohongshu.com",
    tier: "global",
    locale: "ZH",
    status: "ready",
  },
  vk: {
    id: "vk",
    name: "VK",
    handle: "@affisell",
    bio: BIOS.platform.vk,
    link: "https://vk.com/affisell",
    tier: "global",
    locale: "RU",
    status: "ready",
  },
  naver: {
    id: "naver",
    name: "Naver",
    handle: "@affisell",
    bio: BIOS.platform.naver,
    link: "https://www.naver.com",
    tier: "global",
    locale: "KO",
    status: "ready",
  },
  line: {
    id: "line",
    name: "LINE",
    handle: "@affisell",
    bio: BIOS.platform.line,
    link: "https://line.me",
    tier: "global",
    locale: "JP",
    status: "ready",
  },
  weibo: {
    id: "weibo",
    name: "Weibo",
    handle: "@affisell",
    bio: BIOS.platform.weibo,
    link: "https://weibo.com",
    tier: "global",
    locale: "ZH",
    status: "ready",
  },
  whatsapp: {
    id: "whatsapp",
    name: "WhatsApp Channel",
    handle: "Affisell",
    bio: BIOS.platform.whatsapp,
    link: "https://www.whatsapp.com/channel",
    tier: "global",
    locale: "FR",
    status: "ready",
  },
  telegram: {
    id: "telegram",
    name: "Telegram",
    handle: "@affisell",
    bio: BIOS.platform.telegram,
    link: "https://t.me/affisell",
    tier: "global",
    locale: "EN",
    status: "ready",
  },
}

export const SOCIAL_PROFILE_LIST: SocialProfile[] = Object.values(SOCIAL_PROFILES)

export const BIO_COPY_BLOCKS = [
  { id: "instagram", label: "Instagram Bio (150)", text: BIOS.platform.instagram, max: 150 },
  { id: "tiktok", label: "TikTok Bio (80)", text: BIOS.platform.tiktok, max: 80 },
  { id: "x", label: "X Bio (160)", text: BIOS.platform.x, max: 160 },
  { id: "linkedin", label: "LinkedIn Tagline", text: BIOS.platform.linkedinTagline, max: 120 },
  { id: "youtube", label: "YouTube About", text: BIOS.platform.youtubeAbout, max: 500 },
  { id: "producthunt", label: "Product Hunt Tagline", text: BIOS.platform.productHunt, max: 60 },
  { id: "long-en", label: "Long bio EN (LinkedIn / PH)", text: BIOS.long.EN, max: 500 },
  { id: "long-fr", label: "Long bio FR", text: BIOS.long.FR, max: 500 },
  { id: "short-fr", label: "Bio courte FR", text: BIOS.short.FR, max: 150 },
  { id: "short-en", label: "Bio courte EN", text: BIOS.short.EN, max: 150 },
  { id: "short-es", label: "Bio courte ES", text: BIOS.short.ES, max: 150 },
  { id: "short-ar", label: "Bio courte AR", text: BIOS.short.AR, max: 150 },
  { id: "short-jp", label: "Bio courte JP", text: BIOS.short.JP, max: 150 },
] as const

export const LOGO_ASSETS = [
  { label: "Mark SVG", href: "/brand/affisell-mark.svg", format: "SVG" },
  { label: "Mark white", href: "/brand/affisell-mark-white.svg", format: "SVG" },
  { label: "Mark black", href: "/brand/affisell-mark-black.svg", format: "SVG" },
  { label: "Maskable", href: "/brand/affisell-mark-maskable.svg", format: "SVG" },
  { label: "Brand kit (MD)", href: "/brand/affisell-brand-kit.md", format: "MD" },
  { label: "Press kit ZIP", href: "/brand/affisell-press-kit.zip", format: "ZIP" },
] as const
