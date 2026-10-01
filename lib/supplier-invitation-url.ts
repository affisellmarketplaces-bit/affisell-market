import { appBaseUrl } from "@/lib/app-base-url"

/**
 * Platform-wide commission ceiling (same bound as lib/url-import-apply.ts,
 * lib/product-variants.ts, lib/affiliate-buyer-reward.ts). Client-safe home for it so both the
 * invite form (client component) and lib/supplier-invitation.ts's server-side validation share
 * one source of truth instead of drifting.
 */
export const SUPPLIER_INVITE_MAX_COMMISSION_PCT = 50

export function supplierInvitationPublicPath(token: string): string {
  return `/invite/supplier/${encodeURIComponent(token)}`
}

export function supplierInvitationPublicUrl(token: string): string {
  return `${appBaseUrl()}${supplierInvitationPublicPath(token)}`
}

export type SupplierInviteShareChannel =
  | "copy"
  | "whatsapp"
  | "email"
  | "linkedin"
  | "x"
  | "sms"
  | "native"

export function buildSupplierInviteSharePayload(args: {
  url: string
  affiliateName: string
  headline?: string
}) {
  const name = args.affiliateName.trim() || "Un revendeur / créateur Affisell"
  const title = args.headline?.trim() || "Rejoignez Affisell — vendez via nos affiliés"
  const body = `${name} vous invite à vendre sur Affisell.\n\n${title}\n\n${args.url}`

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
