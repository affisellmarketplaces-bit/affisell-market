export type DemoPersonaKey = "supplier" | "affiliate" | "buyer"

export type DemoJourneyStep = {
  id: string
  titleKey: string
  bodyKey: string
  href: string
  requiresAuth?: boolean
  external?: boolean
}

export const DEMO_PERSONAS: DemoPersonaKey[] = ["supplier", "affiliate", "buyer"]

export const DEMO_JOURNEY_STEPS: Record<DemoPersonaKey, DemoJourneyStep[]> = {
  supplier: [
    {
      id: "supply",
      titleKey: "steps.supplier.supply.title",
      bodyKey: "steps.supplier.supply.body",
      href: "/dashboard/supplier/supply",
      requiresAuth: true,
    },
    {
      id: "import",
      titleKey: "steps.supplier.import.title",
      bodyKey: "steps.supplier.import.body",
      href: "/dashboard/supplier/import",
      requiresAuth: true,
    },
    {
      id: "preview",
      titleKey: "steps.supplier.preview.title",
      bodyKey: "steps.supplier.preview.body",
      href: "/dashboard/supplier/products",
      requiresAuth: true,
    },
    {
      id: "publish",
      titleKey: "steps.supplier.publish.title",
      bodyKey: "steps.supplier.publish.body",
      href: "/signup/supplier?from=demo",
    },
  ],
  affiliate: [
    {
      id: "discover",
      titleKey: "steps.affiliate.discover.title",
      bodyKey: "steps.affiliate.discover.body",
      href: "/discover",
    },
    {
      id: "catalog",
      titleKey: "steps.affiliate.catalog.title",
      bodyKey: "steps.affiliate.catalog.body",
      href: "/marketplace",
    },
    {
      id: "hub",
      titleKey: "steps.affiliate.hub.title",
      bodyKey: "steps.affiliate.hub.body",
      href: "/dashboard/affiliate",
      requiresAuth: true,
    },
    {
      id: "join",
      titleKey: "steps.affiliate.join.title",
      bodyKey: "steps.affiliate.join.body",
      href: "/signup/affiliate?from=demo",
    },
  ],
  buyer: [
    {
      id: "browse",
      titleKey: "steps.buyer.browse.title",
      bodyKey: "steps.buyer.browse.body",
      href: "/marketplace",
    },
    {
      id: "shop",
      titleKey: "steps.buyer.shop.title",
      bodyKey: "steps.buyer.shop.body",
      href: "/discover",
    },
    {
      id: "trust",
      titleKey: "steps.buyer.trust.title",
      bodyKey: "steps.buyer.trust.body",
      href: "/faq",
    },
    {
      id: "account",
      titleKey: "steps.buyer.account.title",
      bodyKey: "steps.buyer.account.body",
      href: "/signup/customer?from=demo",
    },
  ],
}

export function demoPersonaToPrisma(persona: DemoPersonaKey): "SUPPLIER" | "AFFILIATE" | "BUYER" {
  switch (persona) {
    case "supplier":
      return "SUPPLIER"
    case "affiliate":
      return "AFFILIATE"
    case "buyer":
      return "BUYER"
    default: {
      const _exhaustive: never = persona
      return _exhaustive
    }
  }
}
