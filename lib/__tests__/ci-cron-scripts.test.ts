import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { parseCronFailureReport } from "@/lib/cron/notify-failure"

/**
 * Runs the REAL scripts/ci/*.sh with a fake `curl` first on PATH (no network): the exit codes and annotations that decide
 * whether a failed money cron is red and alerted (finalisation master doc, J1).
 */

const ROOT = process.cwd()
const RUN_CRONS = path.join(ROOT, "scripts/ci/run-crons.sh")
const NOTIFY = path.join(ROOT, "scripts/ci/notify-cron-failure.sh")

const SANDBOX = mkdtempSync(path.join(tmpdir(), "ci-cron-scripts-"))
const BIN = path.join(SANDBOX, "bin")
mkdirSync(BIN)

// Fake curl: answers from a plan file `<path>|<http code>|<exit code>|<body>` (default 200|0|{"ok":true}), logs every call.
const FAKE_CURL = `#!/usr/bin/env bash
out=""; wfmt=""; url=""; method="GET"; data=""; hdrs=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2;;
    -w) wfmt="$2"; shift 2;;
    -H) hdrs="$hdrs;;$2"; shift 2;;
    -X) method="$2"; shift 2;;
    --data) data="$2"; shift 2;;
    --max-time) shift 2;;
    -*) shift;;
    *) url="$1"; shift;;
  esac
done
p="/\${url#*://*/}"
printf '%s\\t%s\\t%s\\t%s\\n' "$method" "$url" "$hdrs" "$data" >> "$FAKE_CURL_LOG"
line="$(grep -F -m1 "$p|" "$FAKE_CURL_PLAN" 2>/dev/null)"
code="200"; rc="0"; body='{"ok":true}'
if [ -n "$line" ]; then
  IFS='|' read -r _ code rc body <<< "$line"
fi
[ -n "$out" ] && printf '%b' "$body" > "$out"
case "$wfmt" in *http_code*) printf '%s' "$code";; esac
exit "$rc"
`
writeFileSync(path.join(BIN, "curl"), FAKE_CURL)
chmodSync(path.join(BIN, "curl"), 0o755)

afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

let seq = 0
type Run = { status: number | null; out: string; calls: string[][]; outputFile: string; summaryFile: string }

function run(
  script: string,
  args: string[],
  plan: string[],
  env: Record<string, string | undefined> = {}
): Run {
  seq += 1
  const dir = path.join(SANDBOX, `run${seq}`)
  mkdirSync(dir)
  const log = path.join(dir, "curl.log")
  const planFile = path.join(dir, "plan.txt")
  const outputFile = path.join(dir, "github_output")
  const summaryFile = path.join(dir, "step_summary")
  writeFileSync(log, "")
  writeFileSync(planFile, plan.join("\n"))
  const result = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      PATH: `${BIN}:${process.env.PATH}`,
      HOME: dir,
      FAKE_CURL_LOG: log,
      FAKE_CURL_PLAN: planFile,
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      CRON_SECRET: "top-secret-cron-value",
      VERCEL_APP_URL: "https://app.example.test/",
      ...env,
    } as unknown as NodeJS.ProcessEnv,
  })
  const calls = readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"))
  return { status: result.status, out: `${result.stdout}${result.stderr}`, calls, outputFile, summaryFile }
}

const called = (r: Run) => r.calls.map((c) => c[1])
const annotations = (r: Run) => r.out.split("\n").filter((l) => l.startsWith("::"))
const failedRoutes = (r: Run) => /failed_routes=(.*)/.exec(readFileSync(r.outputFile, "utf8"))?.[1]

const A = "/api/cron/process-order-payouts"
const B = "/api/cron/retry-pending-clawback"
const C = "/api/cron/reconcile-checkout-orders"

describe("scripts/ci/run-crons.sh — strict (money crons)", () => {
  it("all calls succeed: exit 0, every route called with the Bearer secret, nothing failed", () => {
    const r = run(RUN_CRONS, ["strict", A, B, C], [])
    expect(r.status).toBe(0)
    expect(called(r)).toEqual([`https://app.example.test${A}`, `https://app.example.test${B}`, `https://app.example.test${C}`])
    for (const call of r.calls) expect(call[2]).toContain("Authorization: Bearer top-secret-cron-value")
    expect(failedRoutes(r)).toBe("")
    expect(annotations(r)).toEqual([])
  })

  it.each([
    ["an HTTP 500", `${A}|500|0|{"error":"boom"}`],
    ["an HTTP 401", `${A}|401|0|{"error":"Unauthorized"}`],
    ["an HTTP 404 (route renamed)", `${A}|404|0|Not found`],
    ["an HTTP 302 (a redirect is not a run)", `${A}|302|0|`],
    ["a curl timeout (exit 28, code 000)", `${A}|000|28|`],
    ["a timeout WHILE reading the body (HTTP 200 already received, curl exit 28)", `${A}|200|28|{"ok":`],
    ["a partial transfer (HTTP 200, curl exit 18)", `${A}|200|18|`],
    ["an unreachable host (exit 7, code 000)", `${A}|000|7|`],
  ])("%s exits 1 — the cron is RED, never an echo WARN", (_label, planLine) => {
    const r = run(RUN_CRONS, ["strict", A], [planLine])
    expect(r.status).toBe(1)
    expect(annotations(r).some((l) => l.startsWith(`::error title=Money cron failed (${A})`))).toBe(true)
    expect(failedRoutes(r)).toBe(A)
    expect(readFileSync(r.summaryFile, "utf8")).toContain("**FAILED**")
  })

  it("keeps calling the other routes after a failure, then exits 1 listing every failed route", () => {
    const r = run(RUN_CRONS, ["strict", A, B, C], [`${A}|500|0|x`, `${C}|000|28|`])
    expect(r.status).toBe(1)
    expect(called(r)).toHaveLength(3)
    expect(failedRoutes(r)).toBe(`${A},${C}`)
    expect(annotations(r).filter((l) => l.startsWith("::error title=Money cron failed"))).toHaveLength(2)
  })

  it("never retries (a money route may still be running when curl gives up)", () => {
    const r = run(RUN_CRONS, ["strict", A], [`${A}|500|0|x`])
    expect(called(r)).toHaveLength(1)
  })

  it("never prints the secret, and a response body can not inject workflow commands into the log", () => {
    const body = "boom\n::add-mask::oops\n::error title=fake::injected\n::set-output name=x::y"
    const r = run(RUN_CRONS, ["strict", A], [`${A}|500|0|${body.replace(/\n/g, "\\n")}`])
    expect(r.out).not.toContain("top-secret-cron-value")
    for (const line of annotations(r)) {
      expect(line).toMatch(/^::error title=Money crons? failed/)
    }
    expect(r.out).not.toMatch(/^::add-mask/m)
    expect(r.out).not.toMatch(/^::set-output/m)
  })

  it("missing CRON_SECRET or VERCEL_APP_URL exits 1 with an error and calls nothing", () => {
    for (const env of [{ CRON_SECRET: "" }, { VERCEL_APP_URL: "" }]) {
      const r = run(RUN_CRONS, ["strict", A], [], env)
      expect(r.status).toBe(1)
      expect(r.calls).toEqual([])
      expect(annotations(r)[0]).toMatch(/^::error title=Cron secrets missing/)
    }
  })

  it("refuses a bad mode or no paths (exit 2) instead of silently doing nothing", () => {
    expect(run(RUN_CRONS, ["loud", A], []).status).toBe(2)
    expect(run(RUN_CRONS, [], []).status).toBe(2)
    expect(run(RUN_CRONS, ["strict"], []).status).toBe(2)
  })
})

describe("scripts/ci/run-crons.sh — lenient (housekeeping crons)", () => {
  it("a failure is a ::warning plus a summary line, the other routes still run, exit 0", () => {
    const r = run(RUN_CRONS, ["lenient", A, B], [`${A}|500|0|x`])
    expect(r.status).toBe(0)
    expect(called(r)).toHaveLength(2)
    expect(annotations(r).some((l) => l.startsWith(`::warning title=Cron failed (${A})`))).toBe(true)
    expect(annotations(r).some((l) => l.startsWith("::error"))).toBe(false)
    expect(failedRoutes(r)).toBe(A)
    expect(readFileSync(r.summaryFile, "utf8")).toContain("**FAILED**")
  })

  it("missing secrets are still a hard failure (a misconfigured workflow must not look green)", () => {
    expect(run(RUN_CRONS, ["lenient", A], [], { CRON_SECRET: "" }).status).toBe(1)
  })
})

describe("scripts/ci/notify-cron-failure.sh", () => {
  const ghEnv = {
    GITHUB_WORKFLOW: "Scheduled crons",
    GITHUB_JOB: "money-crons",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: "acme/market",
    GITHUB_RUN_ID: "987654321",
    FAILED_ROUTES: `${A},${B}`,
  }

  beforeEach(() => {
    expect(existsSync(NOTIFY)).toBe(true)
  })

  it("annotates the failure and POSTs the report to /api/cron/notify-failure with the cron secret", () => {
    const r = run(NOTIFY, [], [], ghEnv)
    expect(r.status).toBe(0)
    expect(annotations(r)[0]).toMatch(/^::error title=Cron job failed::Scheduled crons \/ money-crons failed/)
    expect(r.calls).toHaveLength(1)
    const [method, url, headers, data] = r.calls[0]!
    expect(method).toBe("POST")
    expect(url).toBe("https://app.example.test/api/cron/notify-failure")
    expect(headers).toContain("Authorization: Bearer top-secret-cron-value")
    expect(JSON.parse(data!)).toEqual({
      workflow: "Scheduled crons",
      job: "money-crons",
      route: `${A},${B}`,
      runUrl: "https://github.com/acme/market/actions/runs/987654321",
    })
    expect(r.out).not.toContain("top-secret-cron-value")
  })

  it("what the script sends is exactly what the route accepts (script <-> route contract)", () => {
    const r = run(NOTIFY, [], [], ghEnv)
    const parsed = parseCronFailureReport(JSON.parse(r.calls[0]![3]!))
    expect(parsed).toEqual({
      ok: true,
      report: {
        workflow: "Scheduled crons",
        job: "money-crons",
        route: `${A},${B}`,
        runUrl: "https://github.com/acme/market/actions/runs/987654321",
      },
    })
  })

  it("without the secrets it only annotates and warns, calls nothing, exits 0", () => {
    const r = run(NOTIFY, [], [], { ...ghEnv, CRON_SECRET: "" })
    expect(r.status).toBe(0)
    expect(r.calls).toEqual([])
    expect(annotations(r).map((l) => l.split("::")[1]!.split(" ")[0])).toEqual(["error", "warning"])
  })

  it.each([
    ["the app is unreachable (curl exit 7)", `/api/cron/notify-failure|000|7|`],
    ["the app times out (curl exit 28)", `/api/cron/notify-failure|000|28|`],
    ["the app answers 401", `/api/cron/notify-failure|401|0|{}`],
    ["the app answers 500", `/api/cron/notify-failure|500|0|{}`],
  ])("TOLERANT: %s -> a warning, the error annotation stays, exit 0", (_label, planLine) => {
    const r = run(NOTIFY, [], [planLine], ghEnv)
    expect(r.status).toBe(0)
    expect(annotations(r)[0]).toMatch(/^::error title=Cron job failed/)
    expect(annotations(r).some((l) => l.startsWith("::warning title=Failure alert not delivered"))).toBe(true)
  })

  it("a delivered alert prints no warning", () => {
    const r = run(NOTIFY, [], [`/api/cron/notify-failure|200|0|{"ok":true}`], ghEnv)
    expect(annotations(r).some((l) => l.startsWith("::warning"))).toBe(false)
  })

  it("quotes, backslashes and newlines in the names can not break the JSON body (jq builds it)", () => {
    const r = run(NOTIFY, [], [], { ...ghEnv, GITHUB_WORKFLOW: 'x","job":"evil\\', FAILED_ROUTES: 'a"b\nc' })
    const body = JSON.parse(r.calls[0]![3]!)
    expect(Object.keys(body).sort()).toEqual(["job", "route", "runUrl", "workflow"])
    expect(body.job).toBe("money-crons")
    expect(body.workflow).toBe('x","job":"evil\\')
  })

  it("works for the transfers workflow (no failed_routes output, only a literal route)", () => {
    const r = run(NOTIFY, [], [], { ...ghEnv, GITHUB_WORKFLOW: "Process Stripe transfers", GITHUB_JOB: "process-transfers", FAILED_ROUTES: "/api/jobs/process-transfers" })
    const parsed = parseCronFailureReport(JSON.parse(r.calls[0]![3]!))
    expect(parsed.ok).toBe(true)
  })
})
