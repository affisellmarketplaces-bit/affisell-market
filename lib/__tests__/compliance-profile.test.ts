import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  EMPTY_COMPLIANCE_PROFILE,
  euRepAttributesFromProfile,
  hasEuRepBlock,
  hasManufacturerBlock,
  manufacturerAttributesFromProfile,
  parseComplianceProfile,
} from "@/lib/listing-compliance/profile-shared"

const m = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { supplierComplianceProfile: { findUnique: m.findUnique, upsert: m.upsert } } }))

import { GET, PUT } from "@/app/api/supplier/compliance-profile/route"

const FULL = {
  manufacturerName: "Atelier Dupont SAS",
  manufacturerAddress: "12 rue des Lilas, 75011 Paris",
  manufacturerEmail: "contact@dupont.fr",
  manufacturerCountry: "fr",
  euRepName: "Affisell Import SARL",
  euRepAddress: "1 avenue de la République, 69003 Lyon",
  euRepEmail: "gpsr@import.fr",
}

describe("parseComplianceProfile", () => {
  it("accepts a full profile, trimming and upper-casing the country", () => {
    const r = parseComplianceProfile({ ...FULL, manufacturerName: "  Atelier Dupont SAS " })
    expect(r).toMatchObject({ ok: true })
    if (r.ok) expect(r.value).toMatchObject({ manufacturerName: "Atelier Dupont SAS", manufacturerCountry: "FR" })
  })

  it("a partial or empty profile is valid (it may be filled in over time)", () => {
    expect(parseComplianceProfile({})).toEqual({ ok: true, value: EMPTY_COMPLIANCE_PROFILE })
    expect(parseComplianceProfile(null)).toEqual({ ok: true, value: EMPTY_COMPLIANCE_PROFILE })
    expect(parseComplianceProfile({ euRepName: "Only a name" })).toMatchObject({ ok: true })
  })

  it("reports the field and the reason for each invalid value", () => {
    const r = parseComplianceProfile({ ...FULL, manufacturerEmail: "nope", euRepEmail: "x@y", manufacturerCountry: "France", euRepName: "x".repeat(201) })
    expect(r).toEqual({
      ok: false,
      errors: { manufacturerEmail: "invalid_email", euRepEmail: "invalid_email", manufacturerCountry: "invalid_country", euRepName: "too_long" },
    })
  })

  it("ignores unknown keys and non-string values", () => {
    const r = parseComplianceProfile({ ...FULL, isAdmin: true, manufacturerName: 42 })
    expect(r.ok && r.value.manufacturerName).toBe("")
    expect(r.ok && Object.keys(r.value).sort()).toEqual(Object.keys(EMPTY_COMPLIANCE_PROFILE).sort())
  })

  it("maps each block to the reserved attribute keys, skipping empties", () => {
    const p = { ...EMPTY_COMPLIANCE_PROFILE, manufacturerName: "A", manufacturerCountry: "FR", euRepName: "B" }
    expect(manufacturerAttributesFromProfile(p)).toEqual({ gpsr_manufacturer_name: "A", gpsr_manufacturer_country: "FR" })
    expect(euRepAttributesFromProfile(p)).toEqual({ gpsr_eu_rep_name: "B" })
    expect(hasManufacturerBlock(p)).toBe(true)
    expect(hasEuRepBlock(EMPTY_COMPLIANCE_PROFILE)).toBe(false)
  })
})

describe("/api/supplier/compliance-profile", () => {
  const put = (b: unknown) => PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(b) }))
  beforeEach(() => {
    m.auth.mockReset().mockResolvedValue({ user: { id: "sup_1", role: "SUPPLIER" } })
    m.findUnique.mockReset().mockResolvedValue(null)
    m.upsert.mockReset().mockImplementation(async ({ create }: { create: Record<string, string> }) => create)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("is for signed-in suppliers only", async () => {
    m.auth.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
    m.auth.mockResolvedValue({ user: { id: "a", role: "AFFILIATE" } })
    expect((await GET()).status).toBe(403)
    expect((await put(FULL)).status).toBe(403)
    expect(m.upsert).not.toHaveBeenCalled()
  })

  it("GET returns an empty profile when none is saved", async () => {
    const body = await (await GET()).json()
    expect(body).toEqual({ profile: EMPTY_COMPLIANCE_PROFILE, available: true })
    expect(m.findUnique.mock.calls[0]![0].where).toEqual({ userId: "sup_1" })
  })

  it("PUT validates, then stores empty strings as NULL, scoped to the signed-in user (never a body userId)", async () => {
    const res = await put({ ...FULL, userId: "someone_else", euRepName: "" })
    expect(res.status).toBe(200)
    const call = m.upsert.mock.calls[0]![0]
    expect(call.where).toEqual({ userId: "sup_1" })
    expect(call.create.userId).toBe("sup_1")
    expect(call.update.euRepName).toBeNull()
    expect(call.update.manufacturerCountry).toBe("FR")
  })

  it("PUT answers 400 with field errors and writes nothing", async () => {
    const res = await put({ ...FULL, manufacturerEmail: "bad" })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "validation_error", errors: { manufacturerEmail: "invalid_email" } })
    expect(m.upsert).not.toHaveBeenCalled()
  })

  it("when the table is not migrated yet: GET degrades to an empty profile (available:false), PUT answers 503 — nothing else breaks", async () => {
    const missing = new Prisma.PrismaClientKnownRequestError("table missing", { code: "P2021", clientVersion: "test" })
    m.findUnique.mockRejectedValue(missing)
    m.upsert.mockRejectedValue(missing)
    expect(await (await GET()).json()).toEqual({ profile: EMPTY_COMPLIANCE_PROFILE, available: false })
    const res = await put(FULL)
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe("compliance_profile_unavailable")
  })

  it("an unexpected database error is a 500 on save and never leaks details", async () => {
    m.upsert.mockRejectedValue(new Error("connection reset by peer 10.0.0.5"))
    const res = await put(FULL)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5")
  })
})
