import type { SentinelSignalInput } from "@/lib/sentinel/types"

type SentryIssue = {
  id: string
  title: string
  count: string
  level: string
  culprit?: string
  permalink?: string
}

function mapSentrySeverity(level: string, count: number): SentinelSignalInput["severity"] {
  if (level === "fatal" || (level === "error" && count >= 50)) return "P0"
  if (level === "error") return "P1"
  if (level === "warning" && count >= 20) return "P2"
  return "P3"
}

export async function collectSentryIssueSignals(): Promise<SentinelSignalInput[]> {
  const org = process.env.SENTRY_ORG?.trim()
  const project = process.env.SENTRY_PROJECT?.trim()
  const token = process.env.SENTRY_AUTH_TOKEN?.trim()
  if (!org || !project || !token) return []

  const query = new URLSearchParams({
    query: "is:unresolved",
    limit: "8",
    sort: "freq",
  })

  let res: Response
  try {
    res = await fetch(`https://sentry.io/api/0/projects/${org}/${project}/issues/?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    })
  } catch (e) {
    console.log("[sentinel]", {
      collector: "sentry",
      result: "fetch_failed",
      error: e instanceof Error ? e.message : String(e),
    })
    return []
  }

  if (!res.ok) {
    console.log("[sentinel]", { collector: "sentry", result: "api_error", status: res.status })
    return []
  }

  const issues = (await res.json()) as SentryIssue[]
  if (!Array.isArray(issues) || issues.length === 0) return []

  return issues.map((issue) => {
    const count = Number.parseInt(issue.count, 10) || 0
    const culprit = issue.culprit?.trim()
    return {
      severity: mapSentrySeverity(issue.level, count),
      domain: "platform" as const,
      code: "platform.sentry_unresolved",
      title: `Sentry — ${issue.title.slice(0, 72)}`,
      detail: `${count} event(s) in 24h${culprit ? ` · ${culprit}` : ""}.`,
      metric: count,
      entityType: "sentryIssue",
      entityId: issue.permalink ?? issue.id,
      playbook: "open-sentry" as const,
    }
  })
}
