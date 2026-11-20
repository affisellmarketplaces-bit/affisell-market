import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const opsWebhookAlert = vi.fn(async (..._args: unknown[]) => ({ slack: true, discord: false }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: (...a: unknown[]) => opsWebhookAlert(...a) }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))

import { POST } from "@/app/api/cron/notify-failure/route"
import {
  CRON_FAILURE_BODY_MAX_CHARS,
  formatCronFailureAlert,
  neutralizeChatText,
  parseCronFailureReport,
} from "@/lib/cron/notify-failure"

const RUN_URL = "https://github.com/acme/market/actions/runs/123456789"
const goodBody = { workflow: "Scheduled crons", job: "money-crons", route: "/api/cron/process-order-payouts", runUrl: RUN_URL }

function request(body: unknown, headers: Record<string, string> = { authorization: "Bearer s3cret" }, raw = false) {
  return new Request("https://app.test/api/cron/notify-failure", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

const sentText = () => String(opsWebhookAlert.mock.calls[0]?.[0])

describe("POST /api/cron/notify-failure", () => {
  const previous = { secret: process.env.CRON_SECRET, node: process.env.NODE_ENV, vercel: process.env.VERCEL }
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "s3cret"
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    if (previous.secret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous.secret
  })

  describe("authentication — nothing is posted without the cron secret", () => {
    it("refuses a call with no credentials, a wrong secret or a malformed header", async () => {
      expect((await POST(request(goodBody, {}))).status).toBe(401)
      expect((await POST(request(goodBody, { authorization: "Bearer nope" }))).status).toBe(401)
      expect((await POST(request(goodBody, { authorization: "s3cret" }))).status).toBe(401)
      expect((await POST(request(goodBody, { "x-cron-secret": "nope" }))).status).toBe(401)
      expect(opsWebhookAlert).not.toHaveBeenCalled()
    })

    it("refuses an unauthenticated call BEFORE reading the body (an invalid body does not change the answer)", async () => {
      expect((await POST(request("not json", {}, true))).status).toBe(401)
      expect(opsWebhookAlert).not.toHaveBeenCalled()
    })

    it("accepts the Bearer secret and the x-cron-secret header", async () => {
      expect((await POST(request(goodBody))).status).toBe(200)
      expect((await POST(request(goodBody, { "x-cron-secret": "s3cret" }))).status).toBe(200)
      expect(opsWebhookAlert).toHaveBeenCalledTimes(2)
    })

    it("in production with no CRON_SECRET configured the route is closed (503), never open", async () => {
      delete process.env.CRON_SECRET
      vi.stubEnv("NODE_ENV", "production")
      const res = await POST(request(goodBody, {}))
      expect(res.status).toBe(503)
      expect(opsWebhookAlert).not.toHaveBeenCalled()
    })
  })

  describe("the message", () => {
    it("posts one short line naming the workflow, job, route and run", async () => {
      const res = await POST(request(goodBody))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, delivered: { slack: true, discord: false } })
      expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
      expect(sentText()).toBe(
        `🚨 Cron FAILED — Scheduled crons / money-crons — /api/cron/process-order-payouts — ${RUN_URL}`
      )
    })

    it("is bounded: a field longer than its bound is refused, a long-but-near field is truncated", async () => {
      expect((await POST(request({ ...goodBody, route: "a".repeat(1_300) }))).status).toBe(400)
      expect((await POST(request({ ...goodBody, workflow: "a".repeat(500) }))).status).toBe(400)
      expect((await POST(request({ ...goodBody, job: "a".repeat(500) }))).status).toBe(400)
      expect(opsWebhookAlert).not.toHaveBeenCalled()

      const res = await POST(request({ ...goodBody, route: "r".repeat(350) }))
      expect(res.status).toBe(200)
      expect(sentText().length).toBeLessThan(600)
    })

    it("a body over the size cap is refused with 413 and nothing is posted", async () => {
      const res = await POST(request({ ...goodBody, padding: "x".repeat(CRON_FAILURE_BODY_MAX_CHARS + 10) }))
      expect(res.status).toBe(413)
      expect(opsWebhookAlert).not.toHaveBeenCalled()
    })

    it("a Slack / Discord failure is reported in the answer, never thrown", async () => {
      opsWebhookAlert.mockRejectedValueOnce(new Error("slack down"))
      const res = await POST(request(goodBody))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, delivered: { slack: false, discord: false } })
    })
  })

  describe("no mention can be injected into the channel", () => {
    const attacks = [
      "@channel", "@here", "@everyone", "<!channel>", "<!here>", "<!everyone>", "<!subteam^S123>", "<@U123ABC>", "<@&123456>",
      "<#C123>", "＠everyone", "@​here", "[click](https://evil.test)", "<https://evil.test|dashboard>",
    ]

    it.each(attacks)("%s in workflow / job / route reaches the channel without any mention or link syntax", async (attack) => {
      const res = await POST(request({ ...goodBody, workflow: `wf ${attack}`, job: `job ${attack}`, route: `/x ${attack} y` }))
      expect(res.status).toBe(200)
      const text = sentText()
      expect(text).not.toMatch(/@/)
      expect(text).not.toMatch(/[<>[\]!]/)
      expect(text).not.toMatch(/evil\.test/i)
      expect(text).not.toMatch(/＠/)
    })

    it("a text made only of unsafe characters is refused for workflow / job", async () => {
      expect((await POST(request({ ...goodBody, workflow: "\u0000\u0001" }))).status).toBe(400)
    })

    it("runUrl must be a github.com Actions run: any other URL is refused (it would be a phishing link in the channel)", async () => {
      for (const runUrl of [
        "https://evil.test/acme/market/actions/runs/1",
        "http://github.com/acme/market/actions/runs/1",
        "https://github.com.evil.test/acme/market/actions/runs/1",
        "https://user:pw@github.com/acme/market/actions/runs/1",
        "https://github.com/acme/market/pull/1",
        "https://github.com/acme/market/actions/runs/1?x=@everyone",
        "https://github.com/acme/market/actions/runs/abc",
        "javascript:alert(1)",
        "",
      ]) {
        const res = await POST(request({ ...goodBody, runUrl }))
        expect(res.status, runUrl).toBe(400)
      }
      expect(opsWebhookAlert).not.toHaveBeenCalled()
    })
  })

  describe("body validation", () => {
    it.each([
      ["invalid JSON", "{nope", true],
      ["an array", [], false],
      ["null", null, false],
      ["a string", "hello", false],
      ["missing fields", { workflow: "w" }, false],
      ["non-string fields", { ...goodBody, job: 5 }, false],
    ])("%s answers 400", async (_label, body, raw) => {
      const res = await POST(request(body, undefined, raw as boolean))
      expect(res.status).toBe(400)
      expect(opsWebhookAlert).not.toHaveBeenCalled()
    })

    it("only GET-less: the route exports POST only (a GET is a 405 from the framework)", async () => {
      const mod = await import("@/app/api/cron/notify-failure/route")
      expect(Object.keys(mod).filter((k) => ["GET", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([])
    })

    it("an empty route is allowed (the failing path is not always known)", async () => {
      const res = await POST(request({ ...goodBody, route: "" }))
      expect(res.status).toBe(200)
      expect(sentText()).toBe(`🚨 Cron FAILED — Scheduled crons / money-crons — ${RUN_URL}`)
    })
  })
})

describe("neutralizeChatText / parse / format (pure)", () => {
  it("keeps ordinary workflow, job and path text", () => {
    expect(neutralizeChatText("Scheduled crons", 100)).toBe("Scheduled crons")
    expect(neutralizeChatText("/api/cron/a,/api/cron/b-c_d", 100)).toBe("/api/cron/a,/api/cron/b-c_d")
    expect(neutralizeChatText("Process Stripe transfers", 100)).toBe("Process Stripe transfers")
  })

  it("drops every @ and every markup character, collapses whitespace and bounds the length", () => {
    expect(neutralizeChatText("a\n\n  b\t@here <!channel>", 100)).toBe("a b ?here ??channel?")
    expect(neutralizeChatText("see https://evil.test now", 100)).toBe("see https?//evil?test now")
    expect(neutralizeChatText("x".repeat(500), 10)).toHaveLength(10)
    expect(neutralizeChatText(undefined, 10)).toBe("")
    expect(neutralizeChatText(42, 10)).toBe("")
  })

  it("NFKC folds a fullwidth @ before filtering, so it can not sneak through", () => {
    expect(neutralizeChatText("＠everyone", 100)).not.toContain("@")
    expect(neutralizeChatText("＠everyone", 100)).not.toContain("＠")
  })

  it("parse returns the cleaned report; format uses nothing but the report", () => {
    const parsed = parseCronFailureReport(goodBody)
    expect(parsed).toEqual({ ok: true, report: goodBody })
    if (parsed.ok) expect(formatCronFailureAlert(parsed.report)).toContain("money-crons")
  })
})
