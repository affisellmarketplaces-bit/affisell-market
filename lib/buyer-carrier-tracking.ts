/** Build public carrier tracking URLs — no supplier data. */

export function carrierTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  const number = trackingNumber?.trim()
  if (!number) return null
  const c = (carrier ?? "").toLowerCase()
  const encoded = encodeURIComponent(number)

  if (c.includes("colissimo") || c.includes("la poste") || c.includes("laposte")) {
    return `https://www.laposte.fr/outils/suivre-vos-envois?code=${encoded}`
  }
  if (c.includes("chronopost")) {
    return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${encoded}`
  }
  if (c.includes("mondial relay") || c.includes("mondialrelay")) {
    return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${encoded}`
  }
  if (c.includes("dhl")) {
    return `https://www.dhl.com/fr-fr/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encoded}`
  }
  if (c.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encoded}`
  }
  if (c.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`
  }
  if (c.includes("gls")) {
    return `https://gls-group.com/FR/fr/suivi-colis?match=${encoded}`
  }
  return null
}

type DeliveryEstimateInput = {
  status: string
  shippedAt: Date | null
  deliveredAt: Date | null
  shipDeadlineAt: Date | null
  createdAt: Date
}

/** Buyer-facing delivery ETA — no internal SLA jargon. */
export function estimateBuyerDeliveryAt(order: DeliveryEstimateInput): Date | null {
  if (order.deliveredAt) return order.deliveredAt
  if (order.status === "shipped" && order.shippedAt) {
    const eta = new Date(order.shippedAt)
    eta.setDate(eta.getDate() + 5)
    return eta
  }
  if (order.shipDeadlineAt && (order.status === "paid" || order.status === "preparing")) {
    const shipBy = new Date(order.shipDeadlineAt)
    shipBy.setDate(shipBy.getDate() + 4)
    return shipBy
  }
  if (order.status === "paid" || order.status === "preparing") {
    const eta = new Date(order.createdAt)
    eta.setDate(eta.getDate() + 10)
    return eta
  }
  return null
}
