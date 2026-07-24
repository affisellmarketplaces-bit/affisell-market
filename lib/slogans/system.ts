/** Affisell triptyque slogans — buyer TRUST / reseller PROFIT / supplier SCALE. Client-safe. */

export type SloganPersona = "buyer" | "reseller" | "supplier"

export type SloganSystemEntry = {
  base: string
  rotatifs: readonly string[]
  /** Fixed line after the rotating phrase (reseller / supplier). */
  suffix?: string
  /** Tailwind gradient stops for the rotating phrase. */
  color: string
  interval: number
}

export const SLOGAN_SYSTEM = {
  buyer: {
    base: "Stores you trust.",
    rotatifs: [
      "Products verified.",
      "Makers verified.",
      "Payments protected.",
      "Shops curated.",
      "Returns guaranteed.",
      "Quality assured.",
    ],
    color: "from-violet-200 to-indigo-200",
    interval: 3200,
  },
  reseller: {
    base: "Turn",
    rotatifs: [
      "products into profits",
      "ideas into income",
      "listings into cash",
      "clicks into profit",
      "trends into money",
      "views into sales",
    ],
    suffix: "Instantly.",
    color: "from-violet-400 to-indigo-400",
    interval: 2500,
  },
  supplier: {
    base: "Turn",
    rotatifs: [
      "inventory into income",
      "stock into sales",
      "products into stores",
      "catalog into cashflow",
      "warehouse into revenue",
    ],
    suffix: "Instantly.",
    color: "from-emerald-300 to-cyan-300",
    interval: 2700,
  },
} as const satisfies Record<SloganPersona, SloganSystemEntry>

export type SloganSystem = typeof SLOGAN_SYSTEM
