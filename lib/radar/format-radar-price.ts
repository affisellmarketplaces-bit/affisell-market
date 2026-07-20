export function formatRadarPriceDisplay(
  price: { toString(): string } | number,
  currency: string | null
): string {
  const n = typeof price === "number" ? price : Number(price.toString())
  if (!Number.isFinite(n) || n <= 0) return "Prix sur demande"

  const code =
    currency && currency.length === 3
      ? currency.toUpperCase()
      : currency?.toUpperCase() === "EU"
        ? "EUR"
        : "EUR"

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
    }).format(n)
  } catch {
    return `${n.toFixed(2)} ${code}`
  }
}

export function radarSourceLabel(marketplaceId: string, country: string): string {
  if (marketplaceId === "affisell_fr" || (country === "FR" && marketplaceId !== "amazon")) {
    return "Affisell FR"
  }
  if (marketplaceId === "amazon") return "Amazon"
  return marketplaceId.replace(/_/g, " ")
}
