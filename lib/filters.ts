export type StyleFilter = {
  id: string
  name: string
  count: string
}

export type PriceRange = {
  id: string
  name: string
  min: number
  max: number | null
  count: string
}

export type DeliveryOption = {
  id: string
  name: string
  icon: string
  count: string
  badge?: string
}

export type OfferType = {
  id: string
  name: string
  icon: string
  count: string
  color: string
  badge?: string
}

export const STYLE_FILTERS: StyleFilter[] = [
  { id: "minimalist", name: "Minimalist", count: "234k" },
  { id: "vintage", name: "Vintage", count: "189k" },
  { id: "modern", name: "Modern", count: "412k" },
  { id: "boho", name: "Bohemian", count: "156k" },
  { id: "classic", name: "Classic", count: "321k" },
  { id: "sporty", name: "Sporty", count: "287k" },
  { id: "luxury", name: "Luxury", count: "98k" },
  { id: "casual", name: "Casual", count: "523k" },
  { id: "formal", name: "Formal", count: "178k" },
  { id: "industrial", name: "Industrial", count: "67k" },
  { id: "scandinavian", name: "Scandinavian", count: "89k" },
  { id: "rustic", name: "Rustic", count: "112k" },
  { id: "art-deco", name: "Art Deco", count: "43k" },
  { id: "mid-century", name: "Mid-Century Modern", count: "76k" },
  { id: "gothic", name: "Gothic", count: "21k" },
]

export const PRICE_RANGES: PriceRange[] = [
  { id: "under-25", name: "Under $25", min: 0, max: 25, count: "1.2M" },
  { id: "25-50", name: "$25 to $50", min: 25, max: 50, count: "2.1M" },
  { id: "50-100", name: "$50 to $100", min: 50, max: 100, count: "1.8M" },
  { id: "100-200", name: "$100 to $200", min: 100, max: 200, count: "892k" },
  { id: "200-500", name: "$200 to $500", min: 200, max: 500, count: "423k" },
  { id: "500-1000", name: "$500 to $1,000", min: 500, max: 1000, count: "187k" },
  { id: "over-1000", name: "$1,000 & Above", min: 1000, max: null, count: "94k" },
]

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: "free-shipping", name: "Free Shipping", icon: "📦", count: "4.2M" },
  { id: "prime", name: "Affisell Prime", icon: "⚡", count: "1.8M", badge: "FAST" },
  { id: "same-day", name: "Same Day Delivery", icon: "🚀", count: "234k" },
  { id: "next-day", name: "Next Day Delivery", icon: "📅", count: "567k" },
  { id: "1-2-days", name: "1-2 Business Days", icon: "🚚", count: "2.1M" },
  { id: "international", name: "International Shipping", icon: "🌍", count: "892k" },
  { id: "pickup", name: "In-Store Pickup", icon: "🏪", count: "123k" },
  { id: "local-delivery", name: "Local Delivery", icon: "📍", count: "67k" },
]

export const OFFER_TYPES: OfferType[] = [
  { id: "on-sale", name: "On Sale", icon: "🏷️", count: "234k", color: "red" },
  { id: "clearance", name: "Clearance", icon: "💥", count: "89k", color: "orange" },
  { id: "new-arrivals", name: "New Arrivals", icon: "✨", count: "156k", color: "emerald" },
  { id: "best-sellers", name: "Best Sellers", icon: "🔥", count: "312k", color: "amber" },
  { id: "bundle-deals", name: "Bundle Deals", icon: "📦", count: "67k", color: "violet" },
  { id: "flash-sale", name: "Flash Sale", icon: "⚡", count: "23k", color: "rose", badge: "LIVE" },
  { id: "coupons", name: "Coupon Available", icon: "🎟️", count: "445k", color: "blue" },
  { id: "subscribe-save", name: "Subscribe & Save", icon: "🔄", count: "178k", color: "teal" },
  { id: "used-like-new", name: "Used - Like New", icon: "♻️", count: "92k", color: "green" },
  { id: "refurbished", name: "Certified Refurbished", icon: "🔧", count: "34k", color: "slate" },
]
