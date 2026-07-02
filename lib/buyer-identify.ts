import { buyerEmailFromPhone, formatBuyerPhoneDisplay, normalizeBuyerPhone } from "@/lib/buyer-phone"
import { prisma } from "@/lib/prisma"

export type BuyerIdentifyInput =
  | { channel: "email"; email: string }
  | { channel: "phone"; phone: string }

export type BuyerIdentifyResult =
  | { ok: true; userId: string; email: string; isNew: boolean; displayLabel: string }
  | { ok: false; error: string; status: number }

function normalizeEmail(raw: string): string | null {
  const t = raw.trim().toLowerCase()
  if (!t.includes("@") || t.length < 5 || t.startsWith("@") || t.endsWith("@")) return null
  if (t.endsWith("@buyer.affisell.local")) return null
  return t
}

export async function identifyBuyerForCheckout(input: BuyerIdentifyInput): Promise<BuyerIdentifyResult> {
  let email: string
  let displayLabel: string

  if (input.channel === "email") {
    const norm = normalizeEmail(input.email)
    if (!norm) return { ok: false, error: "Adresse e-mail invalide.", status: 400 }
    email = norm
    displayLabel = norm
  } else {
    const digits = normalizeBuyerPhone(input.phone)
    if (!digits) return { ok: false, error: "Numéro de téléphone invalide.", status: 400 }
    email = buyerEmailFromPhone(digits)
    displayLabel = formatBuyerPhoneDisplay(digits)
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, name: true },
  })

  if (existing) {
    if (existing.role !== "CUSTOMER") {
      return {
        ok: false,
        error: "Cet identifiant est lié à un compte professionnel. Utilisez une autre adresse ou connectez-vous sur l’espace adapté.",
        status: 409,
      }
    }
    return {
      ok: true,
      userId: existing.id,
      email,
      isNew: false,
      displayLabel: existing.name?.trim() || displayLabel,
    }
  }

  const created = await prisma.user.create({
    data: {
      email,
      password: null,
      role: "CUSTOMER",
      name: input.channel === "phone" ? displayLabel.slice(0, 120) : null,
    },
    select: { id: true },
  })

  return {
    ok: true,
    userId: created.id,
    email,
    isNew: true,
    displayLabel,
  }
}
