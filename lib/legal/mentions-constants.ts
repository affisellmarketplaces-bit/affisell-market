/** Hosting provider — LCEN art. 6 III 2°. */
export const VERCEL_HOST_LEGAL = {
  name: "Vercel Inc.",
  street: "340 S Lemon Ave #4133",
  city: "Walnut",
  state: "CA",
  postalCode: "91789",
  countryFr: "États-Unis",
  countryEn: "United States",
  website: "https://vercel.com",
} as const

/** EU online dispute resolution platform (Règl. UE 524/2013). */
export const EU_CONSUMER_ODR_URL = "https://ec.europa.eu/consumers/odr"

export function formatVatIntracommunautaire(tva: string): string {
  const digits = tva.replace(/\D/g, "")
  if (!digits) return "[PLACEHOLDER — TVA intracommunautaire]"
  const suffix = digits.length >= 11 ? digits.slice(0, 11) : digits.padStart(11, "0")
  return `FR${suffix}`
}
