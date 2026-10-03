import { beforeEach, describe, expect, it, vi } from "vitest"

const { storeFindUnique, orderFindUnique, resendSend } = vi.hoisted(() => ({
  storeFindUnique: vi.fn(),
  orderFindUnique: vi.fn(),
  resendSend: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: { store: { findUnique: storeFindUnique }, order: { findUnique: orderFindUnique } },
}))
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend }
  },
}))
vi.mock("@/lib/emails/resend-delivery", () => ({
  readResendDeliveryConfig: () => ({ apiKey: "k", from: "Affisell <noreply@affisell.com>", testEmailTo: "" }),
  resolveResendDeliveryRecipient: (_ctx: string, to: string) => ({ to }),
  sendResendEmail: vi.fn(),
}))

import { resolveEmailBrandForAffiliate, resolveEmailBrandForOrder } from "@/lib/emails/email-brand.server"
import { sendShippingNotificationEmail } from "@/lib/emails/send-shipping-notification"
import { sendDeliveredNotificationEmail } from "@/lib/emails/send-delivered-notification"
import { sendCancelledNotificationEmail } from "@/lib/emails/send-cancelled-notification"

const STORE_ROW = {
  name: 'Maison "Léa" <x>',
  logoUrl: "https://cdn.example.com/lea.png",
  customDomain: "Maison-Lea.com",
  domainVerified: true,
  storefrontTheme: { primary: "#BE185D", accent: "#000" },
}

describe("resolveEmailBrandForAffiliate", () => {
  beforeEach(() => {
    storeFindUnique.mockReset()
    orderFindUnique.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("builds a sanitised store brand", async () => {
    storeFindUnique.mockResolvedValue(STORE_ROW)
    const brand = await resolveEmailBrandForAffiliate("aff-1")
    expect(brand).toEqual({
      name: "Maison Léa x",
      isStore: true,
      logoUrl: "https://cdn.example.com/lea.png",
      primaryColor: "#be185d",
      onPrimaryColor: "#ffffff",
      siteHost: "maison-lea.com",
    })
    expect(storeFindUnique.mock.calls[0]![0].where).toEqual({ userId: "aff-1" })
  })

  it("only shows a custom domain once it is verified", async () => {
    storeFindUnique.mockResolvedValue({ ...STORE_ROW, domainVerified: false })
    expect((await resolveEmailBrandForAffiliate("aff-1")).siteHost).toBeNull()
  })

  it("drops an unsafe logo or colour instead of rendering it", async () => {
    storeFindUnique.mockResolvedValue({ ...STORE_ROW, logoUrl: "javascript:alert(1)", storefrontTheme: { primary: "red" } })
    const brand = await resolveEmailBrandForAffiliate("aff-1")
    expect(brand.logoUrl).toBeNull()
    expect(brand.primaryColor).toBeNull()
    expect(brand.onPrimaryColor).toBeNull()
  })

  it("falls back to the platform when there is no affiliate, no store, or the lookup fails", async () => {
    expect((await resolveEmailBrandForAffiliate(null)).isStore).toBe(false)
    storeFindUnique.mockResolvedValue(null)
    expect((await resolveEmailBrandForAffiliate("aff-1")).isStore).toBe(false)
    storeFindUnique.mockRejectedValue(new Error("db down"))
    expect((await resolveEmailBrandForAffiliate("aff-1")).isStore).toBe(false)
  })

  it("resolves through the order's affiliate", async () => {
    orderFindUnique.mockResolvedValue({ affiliateId: "aff-9" })
    storeFindUnique.mockResolvedValue(STORE_ROW)
    expect((await resolveEmailBrandForOrder("ord-1")).isStore).toBe(true)
    expect(storeFindUnique.mock.calls[0]![0].where).toEqual({ userId: "aff-9" })
  })
})

const shipOrder = {
  id: "clorder000000abcdef",
  customerEmail: "buyer@example.com",
  quantity: 1,
  trackingNumber: "TRK123",
  trackingCarrier: "Colissimo",
  product: { name: "Casque", images: ["https://cdn.example.com/p.jpg"] },
}

describe("buyer status emails are sent under the store's brand", () => {
  beforeEach(() => {
    storeFindUnique.mockReset()
    orderFindUnique.mockReset()
    resendSend.mockReset().mockResolvedValue({ data: { id: "re_1" }, error: null })
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })

  it("shipping: store sender name, subject, header and footer — no platform domain", async () => {
    orderFindUnique.mockResolvedValue({ affiliateId: "aff-1" })
    storeFindUnique.mockResolvedValue({ ...STORE_ROW, name: "Maison Léa" })
    await expect(sendShippingNotificationEmail(shipOrder, { locale: "fr" })).resolves.toEqual({ ok: true })
    const msg = resendSend.mock.calls[0]![0]
    expect(msg.from).toBe("Maison Léa <noreply@affisell.com>")
    expect(msg.subject).not.toMatch(/affisell/i)
    expect(msg.html).toContain("Maison Léa")
    expect(msg.html).toContain("maison-lea.com")
    expect(msg.html).not.toContain("affisell-market.vercel.app")
    expect(msg.html).toContain("#be185d")
    expect(msg.html).toContain("https://cdn.example.com/lea.png")
  })

  it("shipping: an order with no store keeps the platform identity exactly as before", async () => {
    orderFindUnique.mockResolvedValue({ affiliateId: null })
    await sendShippingNotificationEmail(shipOrder, { locale: "fr" })
    const msg = resendSend.mock.calls[0]![0]
    expect(msg.from).toBe("Affisell <noreply@affisell.com>")
    expect(msg.html).toContain("Affisell — affisell-market.vercel.app")
    expect(msg.html).toContain("#5469d4")
  })

  it("delivered and cancelled follow the same rule", async () => {
    orderFindUnique.mockResolvedValue({ affiliateId: "aff-1" })
    storeFindUnique.mockResolvedValue({ ...STORE_ROW, name: "Maison Léa" })
    await sendDeliveredNotificationEmail(
      { ...shipOrder, affiliateProductId: "ap1" },
      { locale: "fr" }
    )
    await sendCancelledNotificationEmail(
      { ...shipOrder, sellingPriceCents: 4999 },
      { locale: "fr", cancelReason: "Rupture" }
    )
    for (const [msg] of resendSend.mock.calls) {
      expect(msg.from).toBe("Maison Léa <noreply@affisell.com>")
      expect(msg.html).not.toContain("affisell-market.vercel.app")
      expect(msg.html).toContain("Maison Léa")
    }
    expect(resendSend).toHaveBeenCalledTimes(2)
  })

  it("a brand lookup failure never blocks the email", async () => {
    orderFindUnique.mockRejectedValue(new Error("db down"))
    await expect(sendShippingNotificationEmail(shipOrder, { locale: "fr" })).resolves.toEqual({ ok: true })
    expect(resendSend.mock.calls[0]![0].from).toBe("Affisell <noreply@affisell.com>")
  })
})
