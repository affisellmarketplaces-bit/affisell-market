import { render } from "@react-email/render"
import { Resend } from "resend"

import { BrandPresetAbWinnerEmail } from "@/emails/brand-preset-ab-winner"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import type { PresetAbVariant } from "@/lib/storefront-preset-ab-shared"
import {
  formatPresetAbWinnerReason,
  formatPresetAbWinnerVariant,
} from "@/lib/storefront-preset-ab-winner-shared"

export async function sendBrandPresetAbWinnerEmail(args: {
  email: string
  name?: string | null
  storeName: string
  winner: PresetAbVariant
  winnerReason: Parameters<typeof formatPresetAbWinnerReason>[0]["reason"]
  viewsControl: number
  viewsChallenger: number
  brandStudioPath: string
  locale?: "fr" | "en"
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("brand-preset-ab-winner", args.email, config)
  const brandStudioUrl = `${resolveAppUrl()}${args.brandStudioPath}`
  const winnerLabel = formatPresetAbWinnerVariant({ variant: args.winner, locale })
  const reasonLine = formatPresetAbWinnerReason({ reason: args.winnerReason, locale })

  const html = await render(
    BrandPresetAbWinnerEmail({
      name: args.name?.trim() || (locale === "en" ? "there" : "bonjour"),
      storeName: args.storeName,
      winnerLabel,
      reasonLine,
      viewsControl: args.viewsControl,
      viewsChallenger: args.viewsChallenger,
      brandStudioUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Preset A/B winner applied — ${args.storeName}`
      : `Gagnant A/B preset appliqué — ${args.storeName}`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
