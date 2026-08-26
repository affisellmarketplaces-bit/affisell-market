import type { IngEscalationCandidate } from "@/lib/ing/escalation"

export type IngSlackAlertPayload = {
  groupsCount: number
  sent: number
  skipped48h: number
  resendIds: string[]
  topSupplier?: {
    email: string
    name: string
    manualGroups: number
  }
  escalationCandidates?: IngEscalationCandidate[]
  dryRun?: boolean
}

type SlackBlock =
  | { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
  | { type: "section"; fields?: Array<{ type: "mrkdwn"; text: string }>; text?: { type: "mrkdwn"; text: string } }
  | { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }
  | { type: "divider" }

function buildSlackBlocks(payload: IngSlackAlertPayload): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: payload.dryRun ? "🤖 Ing — Manual Nudge (dry-run)" : "🤖 Ing — Manual Nudge Report",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Groups (7d)*\n${payload.groupsCount}` },
        { type: "mrkdwn", text: `*Suppliers sent*\n${payload.sent}` },
        { type: "mrkdwn", text: `*Skipped 48h*\n${payload.skipped48h}` },
        {
          type: "mrkdwn",
          text: `*Resend IDs*\n${payload.resendIds.length > 0 ? payload.resendIds.slice(0, 5).join(", ") : "—"}`,
        },
      ],
    },
  ]

  if (payload.topSupplier) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Top supplier: *${payload.topSupplier.name}* (${payload.topSupplier.email}) — ${payload.topSupplier.manualGroups} groups`,
        },
      ],
    })
  }

  const escalations = payload.escalationCandidates ?? []
  if (escalations.length > 0) {
    blocks.push({ type: "divider" })
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *${escalations.length} supplier${escalations.length > 1 ? "s" : ""} n'ont jamais répondu après 3+ relances — action requise*`,
      },
    })
    for (const row of escalations.slice(0, 5)) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `• ${row.email} — ${row.nudges} nudges, ${row.manualGroups} manual groups, last order ${row.daysSinceLastOrder ?? "?"}d ago`,
          },
        ],
      })
    }
  }

  return blocks
}

export async function sendIngSlackAlert(payload: IngSlackAlertPayload): Promise<{ sent: boolean }> {
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!webhook) {
    console.log("[ing:slack]", {
      result: "skipped",
      reason: "SLACK_WEBHOOK_URL not configured",
      groupsCount: payload.groupsCount,
      sent: payload.sent,
      skipped48h: payload.skipped48h,
      escalations: payload.escalationCandidates?.length ?? 0,
    })
    return { sent: false }
  }

  const body = {
    text: `Ing manual nudge — ${payload.sent} sent, ${payload.groupsCount} groups (7d)`,
    blocks: buildSlackBlocks(payload),
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error("[ing:slack]", {
        result: "failed",
        status: res.status,
        body: errText.slice(0, 200),
      })
      return { sent: false }
    }
    console.log("[ing:slack]", {
      result: "sent",
      groupsCount: payload.groupsCount,
      sent: payload.sent,
      skipped48h: payload.skipped48h,
    })
    return { sent: true }
  } catch (error) {
    console.error("[ing:slack]", {
      result: "error",
      error: error instanceof Error ? error.message : String(error),
    })
    return { sent: false }
  }
}
