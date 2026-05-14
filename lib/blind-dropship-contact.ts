/** Email shown to supplier systems — masks the real buyer; replies route to Affisell ops (configure inbound on your mail provider). */
export function blindDropshipSupplierContactEmail(orderId: string): string {
  const domain = process.env.BLIND_DROPSHIP_ORDER_EMAIL_DOMAIN?.trim() || "orders.internal"
  const safe = orderId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
  return `commande+${safe}@${domain}`
}
