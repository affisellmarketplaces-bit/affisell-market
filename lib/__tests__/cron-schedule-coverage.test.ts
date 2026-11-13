import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { parse } from "yaml"
import { describe, expect, it } from "vitest"

/**
 * Finalisation master doc, J1 — crons.
 *  1. every route under app/api/cron/* is scheduled (GitHub Actions or vercel.json) OR listed below as deliberately
 *     unscheduled WITH the reason (a route nobody calls is dead code that looks alive);
 *  2. every money cron is run in `strict` mode (exit 1 on failure) by a job that alerts on failure, and no `|| echo WARN`
 *     (or any other swallow) is left on it.
 */

const ROOT = process.cwd()
const WORKFLOW_DIR = path.join(ROOT, ".github/workflows")
const CRON_DIR = path.join(ROOT, "app/api/cron")

/** Routes that exist but are NOT scheduled, and why. Adding a route here is a decision, not a way to silence the test. */
const UNSCHEDULED_ON_PURPOSE: Record<string, string> = {
  "review-invites":
    "Deprecated alias of review-reminder (its own docstring), which is scheduled daily: scheduling both would run the same reminders twice.",
  "sync-auto-buy-tracking":
    "Auto-buy is opt-in and off by default (AUTO_BUY_ENABLED) and its tracking source (fetchAeTrackingPlaceholder) always returns null (master doc G4): it would poll for nothing. Schedule it when auto-buy is validated.",
  "update-supplier-scores":
    "Recomputes what refresh-supplier-trust-scores and refresh-supplier-delivery-stats (both scheduled) already compute, and inserts a TRUST_SCORE_LOW notification per low-score supplier at every run with no de-duplication: scheduled, it would re-notify the same suppliers daily.",
  "verify-suppliers":
    "Grants AND revokes the 'verified supplier' badge and trust tier of every supplier from computed metrics (a visible product decision that can strip a manually verified supplier) and runs 2-3 queries per supplier, more than the 10 s default function budget: owner decision before it runs.",
  "sync-stock":
    "Writes Product.active = (stock > 0) for EVERY product matching a partner SKU (route.ts): it re-lists a product a supplier paused (PATCH active=false) or an admin recalled (GPSR createRecall sets active=false) as soon as the partner reports stock. What `active` means (listed / sellable / recalled) is a founder decision: until it is made the route stays but is not run on a schedule.",
  "notify-failure":
    "Called by the `if: failure()` step of a failed cron job (POST, scripts/ci/notify-cron-failure.sh), never on a schedule.",
}

/** Crons that move or reconcile money, or watch it: they must FAIL visibly. Paths without the /api/cron/ prefix are jobs. */
const MONEY_CRONS = [
  "/api/cron/process-order-payouts",
  "/api/cron/retry-pending-clawback",
  "/api/cron/reconcile-checkout-orders",
  "/api/cron/reconcile",
  "/api/cron/stripe-health",
  "/api/cron/enforce-supplier-ship-sla",
  "/api/cron/replay-failed-stripe-webhooks",
]

type Step = { name?: string; id?: string; if?: string; run?: string; uses?: string; env?: Record<string, string>; "continue-on-error"?: unknown }
type Job = { if?: string; steps: Step[] }
type Workflow = { on: { schedule?: Array<{ cron: string }>; workflow_dispatch?: unknown }; jobs: Record<string, Job> }

function loadWorkflows(): Record<string, Workflow> {
  const out: Record<string, Workflow> = {}
  for (const file of readdirSync(WORKFLOW_DIR)) {
    if (!/\.ya?ml$/.test(file)) continue
    out[file] = parse(readFileSync(path.join(WORKFLOW_DIR, file), "utf8")) as Workflow
  }
  return out
}

const WORKFLOWS = loadWorkflows()

type Invocation = { file: string; job: string; mode: "strict" | "lenient" | "raw"; path: string }

/** Every cron path a workflow `run` block calls, with the mode it is called in. Comments are not `run` text, so they never count. */
function workflowInvocations(): Invocation[] {
  const found: Invocation[] = []
  for (const [file, wf] of Object.entries(WORKFLOWS)) {
    for (const [job, def] of Object.entries(wf.jobs)) {
      for (const step of def.steps) {
        if (!step.run) continue
        const script = step.run.replace(/\\\n/g, " ")
        const runCrons = /run-crons\.sh\s+(strict|lenient)\s+(.*)/.exec(script)
        if (runCrons) {
          for (const m of runCrons[2]!.matchAll(/"(\/api\/[^"]+)"/g)) {
            found.push({ file, job, mode: runCrons[1] as "strict" | "lenient", path: m[1]! })
          }
          continue
        }
        for (const m of script.matchAll(/\/api\/(?:cron|jobs)\/[a-z0-9-]+/g)) {
          found.push({ file, job, mode: "raw", path: m[0] })
        }
      }
    }
  }
  return found
}

function vercelCronPaths(): string[] {
  const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as { crons?: Array<{ path: string }> }
  return (vercel.crons ?? []).map((c) => c.path)
}

const INVOCATIONS = workflowInvocations()
const SCHEDULED_PATHS = new Set([...INVOCATIONS.map((i) => i.path), ...vercelCronPaths()])
const CRON_ROUTES = readdirSync(CRON_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(CRON_DIR, d.name, "route.ts")))
  .map((d) => d.name)
  .sort()

describe("every cron route is scheduled or deliberately not", () => {
  it("finds the cron routes and the workflows (the test is not vacuous)", () => {
    expect(CRON_ROUTES.length).toBeGreaterThan(40)
    expect(INVOCATIONS.length).toBeGreaterThan(40)
    expect(Object.keys(WORKFLOWS)).toContain("scheduled-crons.yml")
  })

  it("has no route that is neither scheduled nor listed as deliberately unscheduled", () => {
    const orphans = CRON_ROUTES.filter(
      (name) => !SCHEDULED_PATHS.has(`/api/cron/${name}`) && !(name in UNSCHEDULED_ON_PURPOSE)
    )
    expect(orphans, `Schedule these in .github/workflows/scheduled-crons.yml or list them with a reason: ${orphans.join(", ")}`).toEqual([])
  })

  it("every deliberately unscheduled route exists, is really not scheduled, and has a real reason", () => {
    for (const [name, reason] of Object.entries(UNSCHEDULED_ON_PURPOSE)) {
      expect(CRON_ROUTES, `${name} is listed as unscheduled but app/api/cron/${name}/route.ts does not exist`).toContain(name)
      expect(SCHEDULED_PATHS.has(`/api/cron/${name}`), `${name} is listed as unscheduled but a workflow calls it`).toBe(false)
      expect(reason.length, `${name} needs a reason`).toBeGreaterThan(60)
    }
  })

  it("every scheduled /api/cron/* path has a route (no typo that would 404 silently)", () => {
    const missing = [...SCHEDULED_PATHS]
      .filter((p) => p.startsWith("/api/cron/"))
      .filter((p) => !CRON_ROUTES.includes(p.slice("/api/cron/".length)))
    expect(missing).toEqual([])
  })

  it("the former orphans are scheduled where they are relevant", () => {
    for (const name of ["auctions-tick", "merchant-kyc-reminder", "sync-shopify", "replay-failed-stripe-webhooks"]) {
      expect(SCHEDULED_PATHS.has(`/api/cron/${name}`), name).toBe(true)
    }
  })
})

describe("workflow schedules are consistent", () => {
  const wf = WORKFLOWS["scheduled-crons.yml"]!
  const declared = (wf.on.schedule ?? []).map((s) => s.cron)

  it("every schedule a job is gated on is declared in `on.schedule` (otherwise the job can never run)", () => {
    for (const [name, job] of Object.entries(wf.jobs)) {
      for (const m of (job.if ?? "").matchAll(/github\.event\.schedule == '([^']+)'/g)) {
        expect(declared, `job ${name} waits for '${m[1]}' which is not declared`).toContain(m[1])
      }
    }
  })

  it("every declared schedule triggers at least one job (otherwise it only burns runner minutes)", () => {
    const gated = Object.values(wf.jobs).flatMap((j) => [...(j.if ?? "").matchAll(/github\.event\.schedule == '([^']+)'/g)].map((m) => m[1]!))
    for (const cron of declared) expect(gated, `schedule '${cron}' triggers no job`).toContain(cron)
  })

  it("can still be triggered by hand", () => {
    expect(wf.on).toHaveProperty("workflow_dispatch")
  })
})

describe("money crons fail visibly (J1)", () => {
  const strictByPath = new Map<string, Invocation[]>()
  for (const inv of INVOCATIONS) {
    if (inv.file !== "scheduled-crons.yml") continue
    strictByPath.set(inv.path, [...(strictByPath.get(inv.path) ?? []), inv])
  }

  it.each(MONEY_CRONS)("%s is scheduled, in strict mode only", (cronPath) => {
    const calls = strictByPath.get(cronPath) ?? []
    expect(calls.length, `${cronPath} is not scheduled in scheduled-crons.yml`).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call.mode, `${cronPath} runs in '${call.mode}' mode in job ${call.job}: a money cron must be strict`).toBe("strict")
    }
  })

  it("the three crons named by J1 are strict (they used to end in `|| echo WARN`)", () => {
    for (const p of ["/api/cron/process-order-payouts", "/api/cron/retry-pending-clawback", "/api/cron/reconcile-checkout-orders"]) {
      expect(strictByPath.get(p)?.map((c) => c.mode)).toEqual(["strict"])
    }
  })

  it("every job that runs a strict call has an `if: failure()` step that alerts, with the failed routes passed through", () => {
    const wf = WORKFLOWS["scheduled-crons.yml"]!
    const strictJobs = new Set(INVOCATIONS.filter((i) => i.file === "scheduled-crons.yml" && i.mode === "strict").map((i) => i.job))
    expect(strictJobs.size).toBeGreaterThanOrEqual(3)
    for (const jobName of strictJobs) {
      const steps = wf.jobs[jobName]!.steps
      const crons = steps.find((s) => s.run?.includes("run-crons.sh strict"))!
      expect(crons.id, `${jobName}: the strict step needs id: crons`).toBe("crons")
      expect(crons["continue-on-error"], `${jobName}: a strict step must not continue-on-error`).toBeUndefined()
      const alert = steps.find((s) => s.run?.includes("notify-cron-failure.sh"))
      expect(alert, `${jobName} has no failure alert step`).toBeDefined()
      expect(alert!.if).toBe("failure()")
      expect(alert!.env?.FAILED_ROUTES).toContain("steps.crons.outputs.failed_routes")
      expect(alert!.env?.CRON_SECRET).toContain("secrets.CRON_SECRET")
      expect(alert!.env?.VERCEL_APP_URL).toContain("secrets.VERCEL_APP_URL")
      expect(steps.some((s) => s.uses?.startsWith("actions/checkout")), `${jobName} must check out scripts/ci`).toBe(true)
    }
  })

  it("the transfers workflow (own file) also alerts when it fails", () => {
    const job = WORKFLOWS["process-transfers.yml"]!.jobs["process-transfers"]!
    const alert = job.steps.find((s) => s.run?.includes("notify-cron-failure.sh"))
    expect(alert?.if).toBe("failure()")
    const call = job.steps.find((s) => s.run?.includes("/api/jobs/process-transfers"))!
    expect(call.run).toMatch(/curl -fsS/) // -f: an HTTP error is a non-zero exit
    expect(call["continue-on-error"]).toBeUndefined()
  })

  it("no run block swallows a failure: no `|| echo`, `|| true`, `|| :` and no continue-on-error on a money cron", () => {
    for (const [file, wf] of Object.entries(WORKFLOWS)) {
      if (file !== "scheduled-crons.yml" && file !== "process-transfers.yml") continue
      for (const [jobName, job] of Object.entries(wf.jobs)) {
        for (const step of job.steps) {
          const script = (step.run ?? "").replace(/\\\n/g, " ")
          expect(script, `${file}/${jobName}: '|| echo ...' swallows a failure`).not.toMatch(/\|\|\s*echo/)
          expect(script, `${file}/${jobName}: '|| true' swallows a failure`).not.toMatch(/\|\|\s*(true|:)\b/)
          expect(script, `${file}/${jobName}: silent WARN`).not.toMatch(/WARN:/)
          const touchesMoney = MONEY_CRONS.some((p) => script.includes(`"${p}"`)) || script.includes("/api/jobs/process-transfers")
          if (touchesMoney) expect(step["continue-on-error"], `${file}/${jobName}: continue-on-error on a money cron`).toBeUndefined()
        }
      }
    }
  })
})
