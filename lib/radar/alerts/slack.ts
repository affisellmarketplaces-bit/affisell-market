import "server-only"

export async function sendSlackWebhookText(
  webhookUrl: string,
  text: string
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    return { ok: false, status: res.status, body: body.slice(0, 200) }
  }
  return { ok: true }
}

export function resolveGlobalSlackWebhook(): string | null {
  return process.env.SLACK_WEBHOOK_URL?.trim() || null
}
