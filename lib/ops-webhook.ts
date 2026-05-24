/**
 * Ops alerts (Slack incoming webhook and/or Discord webhook URL).
 */
export async function opsWebhookAlert(text: string): Promise<{ slack: boolean; discord: boolean }> {
  const payload = JSON.stringify({ text: text.slice(0, 2800) })
  const headers = { "Content-Type": "application/json" }

  const slackUrl = process.env.SLACK_WEBHOOK_URL?.trim()
  const discordUrl = process.env.DISCORD_WEBHOOK_URL?.trim()

  const [slack, discord] = await Promise.all([
    slackUrl
      ? fetch(slackUrl, { method: "POST", headers, body: payload }).then(() => true).catch(() => false)
      : Promise.resolve(false),
    discordUrl
      ? fetch(discordUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: text.slice(0, 1900) }),
        })
          .then(() => true)
          .catch(() => false)
      : Promise.resolve(false),
  ])

  return { slack, discord }
}
