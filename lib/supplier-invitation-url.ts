import { appBaseUrl } from "@/lib/app-base-url"

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
  const name = args.affiliateName.trim() || "Un créateur Affisell"
  const title = args.headline?.trim() || "Rejoignez Affisell — vendez via nos affiliés"
  const body = `${name} vous invite à vendre sur Affisell.\n\n${title}\n\n${args.url}`

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
