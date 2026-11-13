/**
 * Cron failure notification (finalisation master doc, J1).
 *
 * The GitHub Actions workflows (`scheduled-crons.yml`, `process-transfers.yml`) call `POST /api/cron/notify-failure` from an
 * `if: failure()` step. The app already owns the Slack / Discord webhook (`SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, used by
 * `lib/ops-webhook.ts`): the founder does not have to copy a URL into GitHub secrets. The body is attacker-influenced data
 * as far as this code is concerned (a request authenticated with the cron secret, but the workflow interpolates names the
 * repository controls), so it is validated, bounded and neutralised before it reaches a chat channel.
 */

/** Hard cap on the request body (bytes of UTF-16 code units as received). The real payload is ~300 bytes. */
export const CRON_FAILURE_BODY_MAX_CHARS = 2_000

const MAX_WORKFLOW = 100
const MAX_JOB = 100
const MAX_ROUTE = 300
const MAX_RUN_URL = 300

export type CronFailureReport = {
  workflow: string
  job: string
  /** The failing cron path(s) — comma separated when a job lists several — or "" when unknown. */
  route: string
  /** https://github.com/<owner>/<repo>/actions/runs/<id> */
  runUrl: string
}

export type ParsedCronFailureReport = { ok: true; report: CronFailureReport } | { ok: false; error: string }

/**
 * Make free text safe to post in Slack / Discord: no mention can fire (`@channel`, `@here`, `@everyone`, `<@U…>`, `<@&role>`,
 * `<!channel>`, `<!subteam^…>`, `<#C…>`), no link or markup can be injected (no `:` and no `.`, so neither `https://x` nor
 * `evil.test` can form), no control character, bounded length. Only a conservative character set survives; everything
 * else becomes `?`. `@` is never kept at all.
 */
export function neutralizeChatText(input: unknown, maxLength: number): string {
  const text = typeof input === "string" ? input : ""
  return text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 _\-/,()#=+]/g, "?")
    .trim()
    .slice(0, maxLength)
}

function isGithubRunUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "" &&
    /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+(\/attempts\/\d+)?$/.test(url.pathname)
  )
}

/** Validate the JSON body: an object whose four fields are short strings, and a GitHub Actions run URL. */
export function parseCronFailureReport(raw: unknown): ParsedCronFailureReport {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "invalid_body" }
  const body = raw as Record<string, unknown>

  for (const [key, max] of [
    ["workflow", MAX_WORKFLOW * 4],
    ["job", MAX_JOB * 4],
    ["route", MAX_ROUTE * 4],
    ["runUrl", MAX_RUN_URL],
  ] as const) {
    const value = body[key]
    if (typeof value !== "string") return { ok: false, error: `invalid_${key}` }
    // Far over the bound: refused outright instead of silently truncated into something that looks legitimate.
    if (value.length > max) return { ok: false, error: `${key}_too_long` }
  }

  const runUrl = (body.runUrl as string).trim()
  if (!isGithubRunUrl(runUrl)) return { ok: false, error: "invalid_runUrl" }

  const workflow = neutralizeChatText(body.workflow, MAX_WORKFLOW)
  const job = neutralizeChatText(body.job, MAX_JOB)
  // A name that is nothing but unsafe characters ("??") is not a name.
  if (!/[A-Za-z0-9]/.test(workflow) || !/[A-Za-z0-9]/.test(job)) return { ok: false, error: "invalid_workflow_or_job" }

  return {
    ok: true,
    report: { workflow, job, route: neutralizeChatText(body.route, MAX_ROUTE), runUrl },
  }
}

/** One short line for the ops channel. Built only from the validated report: nothing else enters the text. */
export function formatCronFailureAlert(report: CronFailureReport): string {
  return (
    `🚨 Cron FAILED — ${report.workflow} / ${report.job}` +
    (report.route ? ` — ${report.route}` : "") +
    ` — ${report.runUrl}`
  )
}
