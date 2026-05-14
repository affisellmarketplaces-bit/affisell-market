export async function blindDropshipSlackAlert(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!url) return
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 2800) }),
  }).catch(() => {})
}
