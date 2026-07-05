import { render } from "@react-email/render"
import { Resend } from "resend"

import { CustomDomainNudgeEmail } from "@/emails/custom-domain-nudge"
import type { CustomDomainActivationState } from "@/lib/custom-domain-activation-shared"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

export async function sendCustomDomainNudgeEmail(args: {
  email: string
  name?: string | null
  storeName: string
  activationState: CustomDomainActivationState
  customDomain?: string | null
  dnsTarget: string
  settingsPath: string
  locale?: "fr" | "en"
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("custom-domain-nudge", args.email, config)
  const settingsUrl = `${resolveAppUrl()}${args.settingsPath}`

  const html = await render(
    CustomDomainNudgeEmail({
      name: args.name?.trim() || (locale === "en" ? "there" : "bonjour"),
      storeName: args.storeName,
      activationState: args.activationState,
      customDomain: args.customDomain,
      dnsTarget: args.dnsTarget,
      settingsUrl,
      locale,
    })
  )

  const subject =
    args.activationState === "needs_domain"
      ? locale === "en"
        ? `${args.storeName} — activate your pro domain`
        : `${args.storeName} — activez votre domaine pro`
      : locale === "en"
        ? `${args.customDomain ?? args.storeName} — finish domain activation`
        : `${args.customDomain ?? args.storeName} — finalisez votre domaine`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
  })

  if (error) {
    console.error("[custom-domain-nudge]", { result: "email_failed", error: error.message })
    return { ok: false, error: error.message }
  }

  console.log("[custom-domain-nudge]", { result: "email_sent", activationState: args.activationState })
  return { ok: true }
}
