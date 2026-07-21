/** Shared ProductRequest DTO — safe for client. */
export type ProductRequestDto = {
  id: string
  resellerId: string
  resellerEmail: string
  title: string
  description: string | null
  category: string
  quantity: number
  targetPrice: number | null
  country: string
  imageUrl: string | null
  status: string
  createdAt: string
}

export const PRODUCT_REQUEST_CATEGORIES = [
  { id: "baby", label: "Bébé" },
  { id: "auto", label: "Auto" },
  { id: "fitness", label: "Fitness" },
  { id: "beauty", label: "Beauté" },
  { id: "tech", label: "Tech" },
  { id: "home", label: "Maison" },
  { id: "fashion", label: "Mode" },
  { id: "general", label: "Général" },
] as const

export const PRODUCT_REQUEST_COUNTRIES = [
  "FR",
  "US",
  "DE",
  "ES",
  "IT",
  "JP",
  "SA",
  "BR",
  "GB",
] as const

export function formatRequestRelativeFr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}
