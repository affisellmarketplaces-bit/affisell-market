/**
 * Client-safe notification type strings + copy (no Prisma).
 * Server code: `@/lib/supplier-invitation-notifications`.
 */

export const SUPPLIER_INVITE_NOTIF = {
  REGISTERED: "SUPPLIER_INVITE_REGISTERED",
  CATALOG_LIVE: "SUPPLIER_INVITE_CATALOG_LIVE",
  NEW_SUPPLIER_CATALOG: "NEW_SUPPLIER_CATALOG",
} as const

export function formatSupplierInviteRegisteredMessage(args: {
  supplierStoreName: string
}): string {
  return `Votre invitation a abouti : ${args.supplierStoreName} vient de créer son compte fournisseur. Ajoutez ses produits dès qu’ils sont en ligne.`
}

export function formatSupplierInviteCatalogLiveMessage(args: {
  supplierStoreName: string
  productName: string
  commissionPct: number
}): string {
  const pct = Number.isFinite(args.commissionPct) ? args.commissionPct.toFixed(1) : "0"
  return `${args.supplierStoreName} a publié « ${args.productName} » (${pct}% commission affilié). Listez-le sur votre vitrine.`
}

export function formatNewSupplierCatalogBroadcastMessage(args: {
  supplierStoreName: string
  productName: string
  commissionPct: number
  invitedByName: string
}): string {
  const pct = Number.isFinite(args.commissionPct) ? args.commissionPct.toFixed(1) : "0"
  return `Nouveau fournisseur : ${args.supplierStoreName} — « ${args.productName} » (${pct}% commission). Invité par ${args.invitedByName}.`
}
