import { appBaseUrl } from "@/lib/app-base-url"

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
    sms: `sms:?&body=${encodeURIComponent(body)}`,
  }
}
