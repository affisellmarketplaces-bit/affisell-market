import type { TransferRole } from "@prisma/client"

import { opsWebhookAlert } from "@/lib/ops-webhook"

function adminSplitsUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://affisell.com")
  return `${base}/admin/splits`
}

export async function alertSplitTransferFailed(args: {
  orderId: string
  role: TransferRole
  errorCode: string | null
  attempts: number
}) {
  if (args.attempts < 3) return

  const text = [
    `🚨 Split failed Order ${args.orderId}`,
    `| ${args.role}`,
    `| ${args.errorCode ?? "unknown"}`,
    `| Resettle: ${adminSplitsUrl()}`,
  ].join(" ")

  await opsWebhookAlert(text)
}
