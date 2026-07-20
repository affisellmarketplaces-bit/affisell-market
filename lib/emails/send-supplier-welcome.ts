import "server-only"

import { SupplierWelcomeProducerEmail } from "@/emails/supplier-welcome-producer"
import { SupplierWelcomeGrossisteEmail } from "@/emails/supplier-welcome-grossiste"
import { trackServer } from "@/lib/analytics"
import {
  readResendDeliveryConfig,
  sendResendReactEmail,
} from "@/lib/emails/resend-delivery"
import { publicAbsoluteUrl } from "@/lib/public-app-url"
import { prisma } from "@/lib/prisma"
import {
  getSupplierKindDisplaySlug,
  type SupplierKind,
  type SupplierKindSetValue,
} from "@/lib/supplier-kind"

export type SendSupplierWelcomeResult =
  | { ok: true; resendId?: string; duplicate?: boolean; skipped?: boolean }
  | { ok: false; error: string; skipped?: boolean }

function welcomeWebhookId(userId: string, kind: SupplierKindSetValue): string {
  return `supplier-kind-welcome:${kind}:${userId}`
}

function displayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split("@")[0] ?? "partenaire"
}

const SUBJECTS: Record<SupplierKindSetValue, string> = {
  stocker: "🔥 Tes 3 premiers produits en tant que Grossiste",
  producer: "🛡️ Domine Google Shopping: empire Producteur en 24h",
}

/**
 * Differentiated welcome email after supplierKind is set.
 * Idempotent per user+kind via processedWebhook. Never throws.
 */
export async function sendSupplierWelcomeEmail(args: {
  userId: string
  kind: SupplierKindSetValue
  previousKind: SupplierKind
  email?: string | null
  name?: string | null
}): Promise<SendSupplierWelcomeResult> {
  const { userId, kind, previousKind } = args

  try {
    if (previousKind === kind) {
      console.log("[email]", {
        result: "skip_same_kind",
        userId,
        kind,
        previousKind,
      })
      return { ok: true, skipped: true }
    }

    const webhookId = welcomeWebhookId(userId, kind)
    const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId } })
    if (existing) {
      console.log("[email]", { result: "duplicate_welcome", userId, kind, webhookId })
      return { ok: true, duplicate: true }
    }

    let email = args.email?.trim() ?? ""
    let name = args.name
    if (!email) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
      if (!user?.email) {
        console.log("[email]", { result: "user_email_missing", userId, kind })
        return { ok: false, error: "user_email_missing" }
      }
      email = user.email
      name = name ?? user.name
    }

    const config = readResendDeliveryConfig()
    if (!config) {
      console.log("[email]", {
        result: "would_send_welcome",
        kind,
        to: email,
        message: `would send welcome ${kind} to ${email}`,
      })
      return { ok: false, error: "RESEND_API_KEY not configured", skipped: true }
    }

    const radarUrl = publicAbsoluteUrl("/radar")
    const display = displayName(name, email)

    const sent =
      kind === "stocker"
        ? await sendResendReactEmail({
            context: "supplier-welcome",
            intendedTo: email,
            subject: SUBJECTS.stocker,
            template: SupplierWelcomeGrossisteEmail,
            props: { name: display, radarUrl },
          })
        : await sendResendReactEmail({
            context: "supplier-welcome",
            intendedTo: email,
            subject: SUBJECTS.producer,
            template: SupplierWelcomeProducerEmail,
            props: { name: display, radarUrl },
          })

    if (!sent.ok) {
      console.error("[email]", {
        result: "welcome_failed",
        userId,
        kind,
        error: sent.error,
      })
      return { ok: false, error: sent.error }
    }

    await prisma.processedWebhook
      .create({
        data: {
          id: webhookId,
          status: "success",
          error: sent.resendId ? `resend:${sent.resendId}` : null,
        },
      })
      .catch((err) => {
        console.warn("[email]", {
          result: "webhook_mark_failed",
          userId,
          kind,
          message: err instanceof Error ? err.message : String(err),
        })
      })

    trackServer(userId, "welcome_email_sent", {
      kind,
      display_kind: getSupplierKindDisplaySlug(kind),
      previous_kind: previousKind,
      resend_id: sent.resendId ?? null,
    })

    console.log("[email]", {
      result: "welcome_sent",
      userId,
      kind,
      resendId: sent.resendId,
    })

    return { ok: true, resendId: sent.resendId }
  } catch (err) {
    console.error("[email]", {
      result: "welcome_failed",
      userId,
      kind,
      message: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : "welcome_failed",
    }
  }
}

/** Fire-and-forget wrapper — never rejects. */
export function scheduleSupplierWelcomeEmail(args: {
  userId: string
  kind: SupplierKindSetValue
  previousKind: SupplierKind
  email?: string | null
  name?: string | null
}): void {
  void sendSupplierWelcomeEmail(args).catch((err) => {
    console.error("[email]", {
      result: "welcome_unhandled",
      message: err instanceof Error ? err.message : String(err),
    })
  })
}
