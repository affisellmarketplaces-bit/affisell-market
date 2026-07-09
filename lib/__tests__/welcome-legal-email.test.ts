import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, getCurrentVersionMock, sendResendReactEmailMock } = vi.hoisted(() => ({
  prismaMock: {
    processedWebhook: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    legalAcceptance: {
      findFirst: vi.fn(),
    },
    termsAcceptanceLog: {
      findFirst: vi.fn(),
    },
  },
  getCurrentVersionMock: vi.fn(),
  sendResendReactEmailMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/legal/lms-resolver", () => ({
  getCurrentVersion: getCurrentVersionMock,
}))
vi.mock("@/lib/emails/resend-delivery", () => ({
  sendResendReactEmail: sendResendReactEmailMock,
}))

import { POST } from "@/app/api/webhooks/user.created/route"
import { sendWelcomeLegalEmail } from "@/lib/emails/send-welcome-legal-email"

const legalVersion = (version: string, hash: string) => ({
  version,
  contentHash: hash,
  document: { slug: "x" },
})

describe("sendWelcomeLegalEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.processedWebhook.findUnique.mockResolvedValue(null)
    prismaMock.processedWebhook.create.mockResolvedValue({ id: "welcome-legal:user_1" })
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "affiliate@test.com",
      name: "Alex",
      role: "AFFILIATE",
      createdAt: new Date("2026-07-10T10:00:00.000Z"),
    })
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null)
    prismaMock.termsAcceptanceLog.findFirst.mockResolvedValue({
      createdAt: new Date("2026-07-10T10:00:00.000Z"),
      ip: "203.0.113.42",
    })
    getCurrentVersionMock.mockImplementation(async (slug: string) => {
      if (slug === "customer") return legalVersion("1.0.0", "hash_cgu")
      if (slug === "affiliate") return legalVersion("1.0.0", "hash_cga")
      if (slug === "privacy") return legalVersion("1.0.0", "hash_privacy")
      return null
    })
    sendResendReactEmailMock.mockResolvedValue({ ok: true, resendId: "re_123" })
  })

  it("sends RGPD welcome email for AFFILIATE with IP audit trail", async () => {
    const result = await sendWelcomeLegalEmail("user_1")
    expect(result.ok).toBe(true)
    expect(sendResendReactEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "welcome-legal-email",
        intendedTo: "affiliate@test.com",
        subject: "Bienvenue chez Affisell - Vos documents légaux",
        props: expect.objectContaining({
          roleLabel: "Affilié",
          roleDocLabel: "CGA",
          cguHash: "hash_cgu",
          roleDocHash: "hash_cga",
          privacyHash: "hash_privacy",
          acceptedIp: "203.0.113.42",
          preheader: expect.stringContaining("Consentements enregistrés le"),
          gdprUrl: expect.stringContaining("/gdpr"),
        }),
      })
    )
    expect(prismaMock.processedWebhook.create).toHaveBeenCalled()
  })

  it("skips duplicate sends", async () => {
    prismaMock.processedWebhook.findUnique.mockResolvedValue({ id: "welcome-legal:user_1" })
    const result = await sendWelcomeLegalEmail("user_1")
    expect(result).toEqual({ ok: true, duplicate: true })
    expect(sendResendReactEmailMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/webhooks/user.created", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret")
  })

  it("requires bearer auth", async () => {
    const res = await POST(
      new Request("http://localhost:3001/api/webhooks/user.created", {
        method: "POST",
        body: JSON.stringify({ userId: "user_1" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("accepts userId when authorized", async () => {
    prismaMock.processedWebhook.findUnique.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "supplier@test.com",
      name: "Sam",
      role: "SUPPLIER",
      createdAt: new Date("2026-07-10T10:00:00.000Z"),
    })
    prismaMock.legalAcceptance.findFirst.mockResolvedValue({
      acceptedAt: new Date("2026-07-10T10:00:00.000Z"),
      ip: "198.51.100.10",
    })
    getCurrentVersionMock.mockImplementation(async (slug: string) => {
      if (slug === "customer") return legalVersion("1.0.0", "hash_cgu")
      if (slug === "supplier") return legalVersion("1.0.0", "hash_cgs")
      if (slug === "privacy") return legalVersion("1.0.0", "hash_privacy")
      return null
    })
    sendResendReactEmailMock.mockResolvedValue({ ok: true, resendId: "re_456" })

    const res = await POST(
      new Request("http://localhost:3001/api/webhooks/user.created", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-cron-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: "user_1" }),
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
