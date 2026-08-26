import type { LegalScanHighRiskRow } from "@/lib/legal/run-legal-scan"

export type LegalSlackAlertPayload = {
  rows: LegalScanHighRiskRow[]
  dryRun?: boolean
}

function resolveLegalWebhook(): string | null {
  return (
    process.env.SLACK_WEBHOOK_URL_JURIDIQUE?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim() ||
    null
  )
}

function formatSlackLine(row: LegalScanHighRiskRow): string {
  const label = row.type === "product" ? "Produit" : "Fournisseur"
  return `🚨 [RISQUE ${row.riskScore}/100] ${label} ${row.targetName} — ${row.issueCode} — ${row.primaryIssue} — Voir /dashboard/admin/legal`
}

export async function sendLegalSlackAlert(payload: LegalSlackAlertPayload): Promise<{ sent: number }> {
  const webhook = resolveLegalWebhook()
  if (!webhook) {
    console.log("[legal:slack]", {
      result: "skipped",
      reason: "SLACK_WEBHOOK_URL_JURIDIQUE / SLACK_WEBHOOK_URL not configured",
      highRisk: payload.rows.length,
    })
    return { sent: 0 }
  }

  if (payload.rows.length === 0) {
    console.log("[legal:slack]", { result: "skipped", reason: "no_high_risk" })
    return { sent: 0 }
  }

  let sent = 0
  const rows = payload.rows.slice(0, 10)

  for (const row of rows) {
    const text = payload.dryRun
      ? `[DRY-RUN] ${formatSlackLine(row)}`
      : formatSlackLine(row)

    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        console.error("[legal:slack]", {
          result: "failed",
          targetId: row.targetId,
          status: res.status,
          body: errText.slice(0, 200),
        })
        continue
      }
      sent += 1
    } catch (error) {
      console.error("[legal:slack]", {
        result: "error",
        targetId: row.targetId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log("[legal:slack]", {
    result: payload.dryRun ? "dry_run" : "sent",
    sent,
    total: rows.length,
  })

  return { sent }
}
