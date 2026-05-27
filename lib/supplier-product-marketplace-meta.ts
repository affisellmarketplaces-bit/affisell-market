/** Optional marketplace-facing fields on Product (shipsFrom, deliveryDays, freeShipping, supplierTag, isLuxury). */
export function parseProductMarketplaceMeta(body: Record<string, unknown>): {
  shipsFrom: string | null
  deliveryDays: number | null
  freeShipping: boolean
  isLuxury: boolean
  supplierTag: string | null
} {
  const shipsFromRaw = body.shipsFrom
  const shipsFrom =
    typeof shipsFromRaw === "string" && shipsFromRaw.trim()
      ? shipsFromRaw.trim().slice(0, 48)
      : null

  const dd = body.deliveryDays
  let deliveryDays: number | null = null
  if (dd != null && dd !== "") {
    const n = Math.round(Number(dd))
    if (Number.isFinite(n) && n >= 0 && n <= 365) deliveryDays = n
  }

  const freeShipping =
    body.freeShipping === true ||
    body.freeShipping === "true" ||
    body.freeShipping === 1 ||
    body.freeShipping === "1"

  const isLuxury =
    body.isLuxury === true ||
    body.isLuxury === "true" ||
    body.isLuxury === 1 ||
    body.isLuxury === "1"

  const st = body.supplierTag
  const supplierTag =
    typeof st === "string" && st.trim() ? st.trim().slice(0, 64) : null

  return { shipsFrom, deliveryDays, freeShipping, isLuxury, supplierTag }
}
