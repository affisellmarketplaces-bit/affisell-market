import { afterEach, describe, expect, it } from "vitest"

import { authorizeRadarAlertsApi } from "@/lib/radar/alerts/auth"
import { sendRadarAlertEmail } from "@/lib/radar/alerts/email"

describe("radar alerts auth", () => {
  const prevApi = process.env.RADAR_ALERTS_API_KEY
  const prevCron = process.env.CRON_SECRET

  afterEach(() => {
    if (prevApi === undefined) delete process.env.RADAR_ALERTS_API_KEY
    else process.env.RADAR_ALERTS_API_KEY = prevApi
    if (prevCron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prevCron
  })

  it("returns 401 UNAUTHORIZED without x-api-key", () => {
    process.env.RADAR_ALERTS_API_KEY = "secret-key-32-chars-minimum!!"
    const res = authorizeRadarAlertsApi(new Request("http://localhost/api/radar/alerts/send", { method: "POST" }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it("accepts valid x-api-key", () => {
    process.env.RADAR_ALERTS_API_KEY = "secret-key-32-chars-minimum!!"
    const res = authorizeRadarAlertsApi(
      new Request("http://localhost/api/radar/alerts/send", {
        method: "POST",
        headers: { "x-api-key": "secret-key-32-chars-minimum!!" },
      })
    )
    expect(res).toBeNull()
  })

  it("accepts x-cron-secret matching CRON_SECRET", () => {
    process.env.RADAR_ALERTS_API_KEY = "other"
    process.env.CRON_SECRET = "cron-secret-value"
    const res = authorizeRadarAlertsApi(
      new Request("http://localhost/api/radar/alerts/send", {
        method: "POST",
        headers: { "x-cron-secret": "cron-secret-value" },
      })
    )
    expect(res).toBeNull()
  })
})

describe("sendRadarAlertEmail", () => {
  const prev = process.env.RESEND_API_KEY

  afterEach(() => {
    if (prev === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = prev
  })

  it("soft-fails when RESEND_API_KEY missing", async () => {
    delete process.env.RESEND_API_KEY
    const result = await sendRadarAlertEmail({
      to: "user@example.com",
      type: "WINNER_RISING",
      title: "Test",
      message: "Hello",
    })
    expect(result).toEqual({ emailed: false, reason: "RESEND_NOT_CONFIGURED" })
  })
})
