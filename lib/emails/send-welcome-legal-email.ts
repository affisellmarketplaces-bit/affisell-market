import "server-only"

import { WelcomeLegalEmail } from "@/emails/welcome-legal"
import { getCurrentVersion } from "@/lib/legal/lms-resolver"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { publicAbsoluteUrl } from "@/lib/public-app-url"
import { prisma } from "@/lib/prisma"

const WELCOME_LEGAL_SUBJECT = "Bienvenue chez Affisell - Vos documents légaux"
const DPO_EMAIL = process.env.DPO_EMAIL?.trim() || "dpo@affisell.com"

type MerchantRole = "SUPPLIER" | "AFFILIATE"

const ROLE_META: Record<
  MerchantRole,
  { roleLabel: string; roleSlug: "supplier" | "affiliate"; roleDocLabel: string }
> = {
  SUPPLIER: { roleLabel: "Fournisseur", roleSlug: "supplier", roleDocLabel: "CGS" },
  AFFILIATE: { roleLabel: "Affilié", roleSlug: "affiliate", roleDocLabel: "CGA" },
}

function formatAcceptedAt(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date)
}

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split("@")[0] ?? "partenaire"
}

export type SendWelcomeLegalEmailResult =
  | { ok: true; resendId?: string; duplicate?: boolean }
  | { ok: false; error: string; skipped?: boolean }

export async function sendWelcomeLegalEmail(userId: string): Promise<SendWelcomeLegalEmailResult> {
  const webhookId = `welcome-legal:${userId}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId } })
  if (existing) {
    console.log("[welcome-legal-email]", { userId, result: "duplicate" })
    return { ok: true, duplicate: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  if (!user) {
    console.log("[welcome-legal-email]", { userId, result: "user_not_found" })
    return { ok: false, error: "user_not_found" }
  }

  const role = user.role
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    console.log("[welcome-legal-email]", { userId, role, result: "skipped_role" })
    return { ok: false, error: "role_not_eligible", skipped: true }
  }

  const meta = ROLE_META[role]
  const [cgu, roleDoc, privacy] = await Promise.all([
    getCurrentVersion("customer", "fr"),
    getCurrentVersion(meta.roleSlug, "fr"),
    getCurrentVersion("privacy", "fr"),
  ])

  if (!cgu || !roleDoc || !privacy) {
    console.log("[welcome-legal-email]", {
      userId,
      role,
      result: "missing_legal_versions",
      hasCgu: Boolean(cgu),
      hasRoleDoc: Boolean(roleDoc),
      hasPrivacy: Boolean(privacy),
    })
    return { ok: false, error: "missing_legal_versions" }
  }

  const sent = await sendResendReactEmail({
    context: "welcome-legal-email",
    intendedTo: user.email,
    subject: WELCOME_LEGAL_SUBJECT,
    template: WelcomeLegalEmail,
    props: {
      name: displayName(user.name, user.email),
      roleLabel: meta.roleLabel,
      acceptedAtLabel: formatAcceptedAt(user.createdAt),
      cguVersion: cgu.version,
      cguHash: cgu.contentHash,
      roleDocLabel: meta.roleDocLabel,
      roleDocVersion: roleDoc.version,
      roleDocHash: roleDoc.contentHash,
      privacyVersion: privacy.version,
      privacyHash: privacy.contentHash,
      legalUrl: publicAbsoluteUrl("/legal"),
      gdprUrl: publicAbsoluteUrl("/dashboard/account/gdpr"),
      dpoEmail: DPO_EMAIL,
    },
  })

  if (!sent.ok) {
    console.log("[welcome-legal-email]", { userId, role, result: "send_failed", error: sent.error })
    return { ok: false, error: sent.error }
  }

  await prisma.processedWebhook.create({
    data: {
      id: webhookId,
      status: "success",
      error: sent.resendId ? `resend:${sent.resendId}` : null,
    },
  })

  console.log("[welcome-legal-email]", {
    userId,
    role,
    resendId: sent.resendId,
    result: "ok",
  })

  return { ok: true, resendId: sent.resendId }
}
