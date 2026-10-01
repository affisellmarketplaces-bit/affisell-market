import { appBaseUrl } from "@/lib/app-base-url"

/**
 * Platform-wide commission ceiling (same bound as lib/url-import-apply.ts,
 * lib/product-variants.ts, lib/affiliate-buyer-reward.ts, and the mirrored
 * lib/supplier-invitation-url.ts for the affiliate→supplier direction). Client-safe home for it
 * so both the invite form (client component) and lib/supplier-affiliate-invitation.ts's
 * server-side validation share one source of truth instead of drifting.
 */
export const SUPPLIER_AFFILIATE_INVITE_MAX_COMMISSION_PCT = 50

export function supplierAffiliateInvitationPublicPath(token: string): string {
  return `/invite/affiliate/${encodeURIComponent(token)}`
}

export function supplierAffiliateInvitationPublicUrl(token: string): string {
  return `${appBaseUrl()}${supplierAffiliateInvitationPublicPath(token)}`
}

export type SupplierAffiliateInviteShareChannel =
  | "copy"
  | "whatsapp"
  | "email"
  | "linkedin"
  | "x"
  | "sms"
  | "native"

export function buildSupplierAffiliateInviteSharePayload(args: {
  url: string
  supplierName: string
  headline?: string
}) {
  const name = args.supplierName.trim() || "Un fournisseur Affisell"
  const title = args.headline?.trim() || "Vendez mes produits sur Affisell"
  const body = `${name} vous invite à devenir affilié sur Affisell.\n\n${title}\n\n${args.url}`

  return {
    title,
    body,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(body)}`,
    email: `mailto:?subject=${encodeURIComponent(`Invitation Affisell — ${name}`)}&body=${encodeURIComponent(body)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(args.url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(body)}`,
    // No leading "&" before the first param — some Android SMS clients drop the body silently
    // when the query string starts with "&" instead of the param itself.
    sms: `sms:?body=${encodeURIComponent(body)}`,
  }
}
