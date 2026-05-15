/** Stripe Checkout / PaymentIntent shipping snapshot stored on `Order.shippingAddress`. */
export function formatOrderShippingAddress(raw: unknown): string {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return "—"
  const o = raw as Record<string, unknown>
  const name = typeof o.name === "string" ? o.name.trim() : ""
  const line1 = typeof o.line1 === "string" ? o.line1.trim() : ""
  const line2 = typeof o.line2 === "string" ? o.line2.trim() : ""
  const city = typeof o.city === "string" ? o.city.trim() : ""
  const state = typeof o.state === "string" ? o.state.trim() : ""
  const postal =
    typeof o.postal_code === "string"
      ? o.postal_code.trim()
      : typeof o.postalCode === "string"
        ? o.postalCode.trim()
        : ""
  const country =
    typeof o.country === "string"
      ? o.country.trim().toUpperCase()
      : typeof o.countryCode === "string"
        ? o.countryCode.trim().toUpperCase()
        : ""
  const lines: string[] = []
  if (name) lines.push(name)
  if (line1) lines.push(line1)
  if (line2) lines.push(line2)
  const cityLine = [postal, city, state].filter(Boolean).join(" ")
  if (cityLine) lines.push(cityLine)
  if (country) lines.push(country)
  return lines.length > 0 ? lines.join("\n") : "—"
}
