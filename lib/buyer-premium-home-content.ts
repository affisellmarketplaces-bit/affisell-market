/** Static copy + imagery — buyer premium home (audit ChatGPT mockup). */

export const BUYER_PREMIUM_NAV_BADGE =
  "Buyer • Premium version • corrigée selon audit ChatGPT" as const

export type BuyerDiscoverCard = {
  id: string
  title: string
  subtitle: string
  icon: "trending" | "sparkles" | "shield" | "stars"
  images: Array<{ src: string; alt: string }>
  href: string
}

export const BUYER_DISCOVER_CARDS: BuyerDiscoverCard[] = [
  {
    id: "trending",
    title: "Trending now",
    subtitle: "Hot this week • +1.2k active shoppers",
    icon: "trending",
    href: "/#explorer",
    images: [
      {
        src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=240&h=240&fit=crop",
        alt: "Sneakers",
      },
      {
        src: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=240&h=240&fit=crop",
        alt: "Ceramic mug",
      },
      {
        src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=240&h=240&fit=crop",
        alt: "Headphones",
      },
    ],
  },
  {
    id: "recommended",
    title: "Recommended for you",
    subtitle: "Based on your interests • Personalized for you",
    icon: "sparkles",
    href: "/discover",
    images: [
      {
        src: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=240&h=240&fit=crop",
        alt: "Perfume",
      },
      {
        src: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=240&h=240&fit=crop",
        alt: "AirPods",
      },
      {
        src: "https://images.unsplash.com/photo-1602603159059-999f7622a184?w=240&h=240&fit=crop",
        alt: "Candle",
      },
    ],
  },
  {
    id: "trusted",
    title: "From trusted stores",
    subtitle: "Vetted sellers • High rating 4.8+ • EU based",
    icon: "shield",
    href: "/shops",
    images: [
      {
        src: "https://images.unsplash.com/photo-1485955900006-10f4d024d419?w=240&h=240&fit=crop",
        alt: "Potted plant",
      },
      {
        src: "https://images.unsplash.com/photo-1610701596007-de9036c41f76?w=240&h=240&fit=crop",
        alt: "Ceramic bowls",
      },
      {
        src: "https://images.unsplash.com/photo-1616594039964-4086a23b1175?w=240&h=240&fit=crop",
        alt: "Bedroom",
      },
    ],
  },
  {
    id: "new",
    title: "New arrivals",
    subtitle: "This week • 230+ new products",
    icon: "stars",
    href: "/#explorer",
    images: [
      {
        src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=240&h=240&fit=crop",
        alt: "Watch",
      },
      {
        src: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=240&h=240&fit=crop",
        alt: "Backpack",
      },
      {
        src: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=240&h=240&fit=crop",
        alt: "Water bottle",
      },
    ],
  },
]

export const BUYER_PREMIUM_TRUST_PILLS = [
  "Verified stores",
  "Protected payments",
  "14-day EU returns",
] as const
