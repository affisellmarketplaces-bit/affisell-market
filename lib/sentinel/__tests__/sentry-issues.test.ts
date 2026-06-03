import { afterEach, describe, expect, it, vi } from "vitest"

import { collectSentryIssueSignals } from "@/lib/sentinel/collectors/sentry-issues"

describe("collectSentryIssueSignals", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns empty when Sentry env is missing", async () => {
    await expect(collectSentryIssueSignals()).resolves.toEqual([])
  })

  it("maps unresolved issues to platform signals", async () => {
    vi.stubEnv("SENTRY_ORG", "affisell")
    vi.stubEnv("SENTRY_PROJECT", "market")
    vi.stubEnv("SENTRY_AUTH_TOKEN", "token")

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "1",
            title: "TypeError in checkout",
            count: "12",
            level: "error",
            culprit: "app/checkout/page.tsx",
            permalink: "https://affisell.sentry.io/issues/1/",
          },
        ],
      })
    )

    const signals = await collectSentryIssueSignals()
    expect(signals).toHaveLength(1)
    expect(signals[0]?.code).toBe("platform.sentry_unresolved")
    expect(signals[0]?.playbook).toBe("open-sentry")
    expect(signals[0]?.entityId).toBe("https://affisell.sentry.io/issues/1/")
  })
})
