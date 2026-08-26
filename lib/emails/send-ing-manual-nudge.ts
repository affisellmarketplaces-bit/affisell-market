import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import {
  readResendDeliveryConfig,
  sendResendEmail,
} from "@/lib/emails/resend-delivery"
import { buildManualSupplierNudgeEmailHtml } from "@/lib/ing/manual-supplier-nudge"

export async function sendIngManualNudgeEmail(args: {
  email: string
  name: string
  manualGroups: number
  totalItems: number
  isCron?: boolean
}): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const integrationsUrl = `${resolveAppUrl()}/dashboard/supplier/integrations`
  const subject = `Action requise: ${args.manualGroups} commande(s) en attente — Activez l'auto-buy`
  const html = buildManualSupplierNudgeEmailHtml({
    name: args.name,
    manualGroups: args.manualGroups,
    totalItems: args.totalItems,
    integrationsUrl,
    isCron: args.isCron ?? true,
  })

  return sendResendEmail({
    context: "cron:ing-manual-nudge",
    config,
    intendedTo: args.email,
    subject,
    html,
  })
}
