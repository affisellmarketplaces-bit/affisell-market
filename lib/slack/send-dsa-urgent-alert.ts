import type { DsaReport } from "@prisma/client"

function resolveLegalWebhook(): string | null {
  return (
    process.env.SLACK_WEBHOOK_URL_JURIDIQUE?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim() ||
    null
  )
}

export async function sendDsaUrgentSlackAlert(
  report: Pick<DsaReport, "id" | "type" | "reporterEmail" | "productId" | "description">
): Promise<{ sent: boolean }> {
  const webhook = resolveLegalWebhook()
  const text = `🚨🚨 [DSA URGENT — art. 16] Signalement ${report.type.toUpperCase()} — ${report.reporterEmail} — ${report.productId ? `Produit ${report.productId}` : "Sans produit"} — ${report.description.slice(0, 120)}… — /dashboard/admin/legal`

  if (!webhook) {
    console.log("[legal:dsa:slack]", { result: "skipped", reportId: report.id })
    return { sent: false }
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.error("[legal:dsa:slack]", { result: "failed", status: res.status, reportId: report.id })
      return { sent: false }
    }
    console.log("[legal:dsa:slack]", { result: "sent", reportId: report.id })
    return { sent: true }
  } catch (error) {
    console.error("[legal:dsa:slack]", {
      result: "error",
      reportId: report.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return { sent: false }
  }
}
