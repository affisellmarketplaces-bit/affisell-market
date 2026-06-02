/** ISO 3166-1 alpha-2 — destinations Affisell checkout + origines fournisseurs courantes. */

export type ShippingCountry = {
  code: string
  labelFr: string
  labelEn: string
  flag: string
}

export const SHIPPING_DESTINATION_COUNTRIES: ShippingCountry[] = [
  { code: "FR", labelFr: "France", labelEn: "France", flag: "🇫🇷" },
  { code: "DE", labelFr: "Allemagne", labelEn: "Germany", flag: "🇩🇪" },
  { code: "BE", labelFr: "Belgique", labelEn: "Belgium", flag: "🇧🇪" },
  { code: "NL", labelFr: "Pays-Bas", labelEn: "Netherlands", flag: "🇳🇱" },
  { code: "ES", labelFr: "Espagne", labelEn: "Spain", flag: "🇪🇸" },
  { code: "IT", labelFr: "Italie", labelEn: "Italy", flag: "🇮🇹" },
  { code: "PT", labelFr: "Portugal", labelEn: "Portugal", flag: "🇵🇹" },
  { code: "CH", labelFr: "Suisse", labelEn: "Switzerland", flag: "🇨🇭" },
  { code: "GB", labelFr: "Royaume-Uni", labelEn: "United Kingdom", flag: "🇬🇧" },
  { code: "US", labelFr: "États-Unis", labelEn: "United States", flag: "🇺🇸" },
  { code: "CA", labelFr: "Canada", labelEn: "Canada", flag: "🇨🇦" },
]

export const SHIPPING_ORIGIN_COUNTRIES: ShippingCountry[] = [
  { code: "CN", labelFr: "Chine", labelEn: "China", flag: "🇨🇳" },
  { code: "FR", labelFr: "France", labelEn: "France", flag: "🇫🇷" },
  { code: "DE", labelFr: "Allemagne", labelEn: "Germany", flag: "🇩🇪" },
  { code: "ES", labelFr: "Espagne", labelEn: "Spain", flag: "🇪🇸" },
  { code: "PL", labelFr: "Pologne", labelEn: "Poland", flag: "🇵🇱" },
  { code: "US", labelFr: "États-Unis", labelEn: "United States", flag: "🇺🇸" },
  { code: "GB", labelFr: "Royaume-Uni", labelEn: "United Kingdom", flag: "🇬🇧" },
]

export type CarrierTier = "premium" | "standard" | "economy"

export type CarrierTag =
  | "express"
  | "tracked"
  | "pickup"
  | "international"
  | "last_mile"
  | "marketplace"

export type ShippingCarrierDef = {
  id: string
  name: string
  tier: CarrierTier
  /** 0–100 — score indicatif basé sur réputation marché & suivi. */
  reliabilityScore: number
  popular: boolean
  tags: CarrierTag[]
  origins: string[]
  destinations: string[]
  etaDaysMin: number
  etaDaysMax: number
  trackingHintFr: string
  trackingHintEn: string
}

export const SHIPPING_CARRIERS: ShippingCarrierDef[] = [
  {
    id: "colissimo",
    name: "Colissimo",
    tier: "standard",
    reliabilityScore: 94,
    popular: true,
    tags: ["tracked", "pickup", "last_mile"],
    origins: ["FR"],
    destinations: ["FR", "BE", "DE", "ES", "IT", "PT", "NL", "CH"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Suivi La Poste · livraison domicile ou point relais",
    trackingHintEn: "La Poste tracking · home or pickup point delivery",
  },
  {
    id: "chronopost",
    name: "Chronopost",
    tier: "premium",
    reliabilityScore: 96,
    popular: true,
    tags: ["express", "tracked"],
    origins: ["FR"],
    destinations: ["FR", "BE", "DE", "ES", "IT", "PT", "NL", "CH", "GB"],
    etaDaysMin: 1,
    etaDaysMax: 3,
    trackingHintFr: "Express 24–48 h · signature possible",
    trackingHintEn: "Express 24–48 h · signature on delivery",
  },
  {
    id: "mondial-relay",
    name: "Mondial Relay",
    tier: "economy",
    reliabilityScore: 88,
    popular: true,
    tags: ["pickup", "tracked"],
    origins: ["FR", "BE", "ES", "NL"],
    destinations: ["FR", "BE", "DE", "ES", "IT", "PT", "NL"],
    etaDaysMin: 3,
    etaDaysMax: 7,
    trackingHintFr: "Retrait en point relais · économique",
    trackingHintEn: "Pickup point delivery · budget-friendly",
  },
  {
    id: "dpd-fr",
    name: "DPD France",
    tier: "standard",
    reliabilityScore: 91,
    popular: true,
    tags: ["tracked", "pickup"],
    origins: ["FR", "DE", "PL"],
    destinations: ["FR", "DE", "BE", "NL", "ES", "IT", "PT", "CH", "GB"],
    etaDaysMin: 2,
    etaDaysMax: 6,
    trackingHintFr: "Predict · créneau de livraison",
    trackingHintEn: "Predict · delivery time slot",
  },
  {
    id: "dhl-paket",
    name: "DHL Paket",
    tier: "standard",
    reliabilityScore: 95,
    popular: true,
    tags: ["tracked", "pickup", "last_mile"],
    origins: ["DE", "FR", "PL"],
    destinations: ["DE", "FR", "BE", "NL", "IT", "ES", "CH"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Réseau DHL national · Packstation disponible",
    trackingHintEn: "DHL domestic network · Packstation available",
  },
  {
    id: "hermes-de",
    name: "Hermes (DE)",
    tier: "economy",
    reliabilityScore: 86,
    popular: true,
    tags: ["tracked", "pickup"],
    origins: ["DE"],
    destinations: ["DE", "NL", "BE"],
    etaDaysMin: 3,
    etaDaysMax: 7,
    trackingHintFr: "Points Packstation & relais",
    trackingHintEn: "Packstation & parcel shop network",
  },
  {
    id: "correos",
    name: "Correos",
    tier: "standard",
    reliabilityScore: 89,
    popular: true,
    tags: ["tracked", "last_mile"],
    origins: ["ES"],
    destinations: ["ES", "PT", "FR", "IT"],
    etaDaysMin: 2,
    etaDaysMax: 6,
    trackingHintFr: "Poste espagnole · suivi national",
    trackingHintEn: "Spanish Post · domestic tracking",
  },
  {
    id: "seur",
    name: "SEUR (DPD Group)",
    tier: "standard",
    reliabilityScore: 90,
    popular: true,
    tags: ["express", "tracked"],
    origins: ["ES"],
    destinations: ["ES", "PT", "FR", "IT"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Express péninsule · fiable B2C",
    trackingHintEn: "Iberian express · reliable B2C",
  },
  {
    id: "postnl",
    name: "PostNL",
    tier: "standard",
    reliabilityScore: 92,
    popular: true,
    tags: ["tracked", "last_mile"],
    origins: ["NL", "BE"],
    destinations: ["NL", "BE", "DE", "FR"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Dernier km Benelux · très suivi",
    trackingHintEn: "Benelux last mile · well tracked",
  },
  {
    id: "bpost",
    name: "bpost",
    tier: "standard",
    reliabilityScore: 90,
    popular: true,
    tags: ["tracked", "pickup"],
    origins: ["BE"],
    destinations: ["BE", "NL", "FR", "DE"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Points bpost & domicile",
    trackingHintEn: "bpost points & home delivery",
  },
  {
    id: "royal-mail",
    name: "Royal Mail",
    tier: "standard",
    reliabilityScore: 88,
    popular: true,
    tags: ["tracked", "last_mile"],
    origins: ["GB"],
    destinations: ["GB"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Poste britannique · Tracked 24/48",
    trackingHintEn: "Royal Mail · Tracked 24/48",
  },
  {
    id: "dpd-uk",
    name: "DPD UK",
    tier: "standard",
    reliabilityScore: 91,
    popular: true,
    tags: ["tracked", "express"],
    origins: ["GB"],
    destinations: ["GB"],
    etaDaysMin: 1,
    etaDaysMax: 4,
    trackingHintFr: "Créneau 1 h · très populaire e-commerce",
    trackingHintEn: "1-hour slot · popular for e-commerce",
  },
  {
    id: "evri",
    name: "Evri (Hermes UK)",
    tier: "economy",
    reliabilityScore: 82,
    popular: true,
    tags: ["tracked", "pickup"],
    origins: ["GB"],
    destinations: ["GB"],
    etaDaysMin: 3,
    etaDaysMax: 7,
    trackingHintFr: "Économique · réseau relais UK",
    trackingHintEn: "Budget · UK parcel shop network",
  },
  {
    id: "usps",
    name: "USPS",
    tier: "standard",
    reliabilityScore: 87,
    popular: true,
    tags: ["tracked", "last_mile"],
    origins: ["US"],
    destinations: ["US"],
    etaDaysMin: 3,
    etaDaysMax: 8,
    trackingHintFr: "Poste US · Priority & Ground",
    trackingHintEn: "USPS · Priority & Ground",
  },
  {
    id: "ups",
    name: "UPS",
    tier: "premium",
    reliabilityScore: 96,
    popular: true,
    tags: ["express", "tracked", "international"],
    origins: ["US", "FR", "DE", "GB", "CN"],
    destinations: ["US", "CA", "GB", "FR", "DE", "BE", "NL", "ES", "IT", "CH"],
    etaDaysMin: 2,
    etaDaysMax: 7,
    trackingHintFr: "Express mondial · référence B2B/B2C",
    trackingHintEn: "Global express · B2B/B2C standard",
  },
  {
    id: "fedex",
    name: "FedEx",
    tier: "premium",
    reliabilityScore: 95,
    popular: true,
    tags: ["express", "tracked", "international"],
    origins: ["US", "FR", "DE", "GB", "CN"],
    destinations: ["US", "CA", "GB", "FR", "DE", "BE", "NL", "ES", "IT", "CH", "PT"],
    etaDaysMin: 2,
    etaDaysMax: 7,
    trackingHintFr: "International priority · suivi temps réel",
    trackingHintEn: "International priority · real-time tracking",
  },
  {
    id: "canada-post",
    name: "Canada Post",
    tier: "standard",
    reliabilityScore: 88,
    popular: true,
    tags: ["tracked", "last_mile"],
    origins: ["CA", "US"],
    destinations: ["CA"],
    etaDaysMin: 3,
    etaDaysMax: 9,
    trackingHintFr: "Poste canadienne · régions éloignées couvertes",
    trackingHintEn: "Canada Post · remote areas covered",
  },
  {
    id: "purolator",
    name: "Purolator",
    tier: "premium",
    reliabilityScore: 93,
    popular: true,
    tags: ["express", "tracked"],
    origins: ["CA"],
    destinations: ["CA"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Express Canada · B2C premium",
    trackingHintEn: "Canada express · premium B2C",
  },
  {
    id: "swiss-post",
    name: "Swiss Post",
    tier: "standard",
    reliabilityScore: 94,
    popular: true,
    tags: ["tracked", "last_mile"],
    origins: ["CH", "DE", "FR"],
    destinations: ["CH"],
    etaDaysMin: 2,
    etaDaysMax: 5,
    trackingHintFr: "Poste suisse · douanes intégrées UE-CH",
    trackingHintEn: "Swiss Post · EU-CH customs handled",
  },
  {
    id: "cainiao",
    name: "Cainiao (Alibaba)",
    tier: "economy",
    reliabilityScore: 85,
    popular: true,
    tags: ["international", "tracked", "marketplace"],
    origins: ["CN"],
    destinations: ["FR", "DE", "BE", "NL", "ES", "IT", "PT", "GB", "US", "CA", "CH"],
    etaDaysMin: 10,
    etaDaysMax: 25,
    trackingHintFr: "AliExpress / 1688 · suivi Cainiao Global",
    trackingHintEn: "AliExpress / 1688 · Cainiao Global tracking",
  },
  {
    id: "yanwen",
    name: "Yanwen",
    tier: "economy",
    reliabilityScore: 83,
    popular: true,
    tags: ["international", "tracked", "marketplace"],
    origins: ["CN"],
    destinations: ["FR", "DE", "BE", "NL", "ES", "IT", "PT", "GB", "US", "CA"],
    etaDaysMin: 12,
    etaDaysMax: 28,
    trackingHintFr: "E-commerce Chine → UE · économique",
    trackingHintEn: "China → EU e-commerce · budget lane",
  },
  {
    id: "4px",
    name: "4PX",
    tier: "economy",
    reliabilityScore: 84,
    popular: true,
    tags: ["international", "tracked", "marketplace"],
    origins: ["CN"],
    destinations: ["FR", "DE", "BE", "NL", "ES", "IT", "GB", "US"],
    etaDaysMin: 10,
    etaDaysMax: 22,
    trackingHintFr: "Cross-border · intégré Shopify / marketplaces",
    trackingHintEn: "Cross-border · Shopify / marketplace integrated",
  },
  {
    id: "china-post-epacket",
    name: "China Post (ePacket)",
    tier: "economy",
    reliabilityScore: 80,
    popular: true,
    tags: ["international", "tracked"],
    origins: ["CN"],
    destinations: ["US", "CA", "GB", "FR", "DE"],
    etaDaysMin: 14,
    etaDaysMax: 30,
    trackingHintFr: "Poste chinoise · lane économique suivie",
    trackingHintEn: "China Post · tracked economy lane",
  },
  {
    id: "sf-express",
    name: "SF Express",
    tier: "premium",
    reliabilityScore: 92,
    popular: true,
    tags: ["express", "international", "tracked"],
    origins: ["CN"],
    destinations: ["FR", "DE", "BE", "NL", "ES", "IT", "GB", "US", "CA", "CH"],
    etaDaysMin: 5,
    etaDaysMax: 12,
    trackingHintFr: "Express Chine · premium tech & mode",
    trackingHintEn: "China express · premium tech & fashion",
  },
  {
    id: "dhl-ecommerce-cn",
    name: "DHL eCommerce",
    tier: "standard",
    reliabilityScore: 90,
    popular: true,
    tags: ["international", "tracked"],
    origins: ["CN", "DE", "US"],
    destinations: ["FR", "DE", "BE", "NL", "ES", "IT", "PT", "GB", "US", "CA", "CH"],
    etaDaysMin: 7,
    etaDaysMax: 18,
    trackingHintFr: "Cross-border DHL · bon compromis délai/prix",
    trackingHintEn: "DHL cross-border · balanced speed/price",
  },
]

export function resolveCarriersForRoute(originCode: string, destinationCode: string): ShippingCarrierDef[] {
  const origin = originCode.toUpperCase()
  const destination = destinationCode.toUpperCase()

  const matched = SHIPPING_CARRIERS.filter(
    (c) => c.origins.includes(origin) && c.destinations.includes(destination)
  )

  return matched.sort((a, b) => {
    if (a.popular !== b.popular) return a.popular ? -1 : 1
    if (b.reliabilityScore !== a.reliabilityScore) return b.reliabilityScore - a.reliabilityScore
    return a.etaDaysMin - b.etaDaysMin
  })
}

export function countryLabel(code: string, locale: "fr" | "en"): string {
  const all = [...SHIPPING_DESTINATION_COUNTRIES, ...SHIPPING_ORIGIN_COUNTRIES]
  const row = all.find((c) => c.code === code.toUpperCase())
  if (!row) return code
  return locale === "fr" ? row.labelFr : row.labelEn
}
