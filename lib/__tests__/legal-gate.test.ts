import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const {
  isDocumentAcceptedMock,
  findFirstMissingDocumentSlugMock,
  isLegalGateV2EnabledMock,
  isLegalGateV2EnabledSyncMock,
} = vi.hoisted(() => ({
  isDocumentAcceptedMock: vi.fn(),
  findFirstMissingDocumentSlugMock: vi.fn(),
  isLegalGateV2EnabledMock: vi.fn(),
  isLegalGateV2EnabledSyncMock: vi.fn(() => false),
}))

vi.mock("@/lib/legal/acceptance", () => ({
  isDocumentAccepted: isDocumentAcceptedMock,
  findFirstMissingDocumentSlug: findFirstMissingDocumentSlugMock,
  computeUserLegalGateHash: vi.fn(),
  collectAcceptedCurrentVersionIds: vi.fn(),
  recordLegalAcceptance: vi.fn(),
}))

vi.mock("@/lib/legal/feature-flags", () => ({
  isLegalGateV2Enabled: isLegalGateV2EnabledMock,
  isLegalGateV2EnabledSync: isLegalGateV2EnabledSyncMock,
  resetLegalGateV2CacheForTests: vi.fn(),
}))

import { checkLegalGate } from "@/lib/legal/legal-gate-server"
import {
  computeLegalGateHash,
  LEGAL_OK_COOKIE,
} from "@/lib/legal/legal-gate-cookie"
import {
  getRequiredDocuments,
  legalGateCookieOk,
  legalGateOk,
  merchantTermsGateOk,
} from "@/lib/middleware-terms-gate"
import { resetLegalGateV2CacheForTests } from "@/lib/legal/feature-flags"

function makeReq(cookieValue?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === LEGAL_OK_COOKIE && cookieValue ? { value: cookieValue } : undefined,
    },
  } as unknown as NextRequest
}

describe("legal gate v2", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLegalGateV2CacheForTests()
    delete process.env.LEGAL_GATE_V2_ENABLED
    isLegalGateV2EnabledMock.mockResolvedValue(true)
    isLegalGateV2EnabledSyncMock.mockReturnValue(true)
  })

  it("passes gate when all required documents are on current version", async () => {
    isDocumentAcceptedMock.mockResolvedValue(true)
    findFirstMissingDocumentSlugMock.mockResolvedValue(null)

    const redirect = await checkLegalGate(
      { id: "user_1", role: "CUSTOMER" },
      "/dashboard",
      makeReq(),
      null
    )

    expect(redirect).toBeNull()
  })

  it("redirects to reaccept when current version bumped", async () => {
    findFirstMissingDocumentSlugMock.mockResolvedValue("customer")

    const redirect = await checkLegalGate(
      { id: "user_1", role: "CUSTOMER" },
      "/dashboard",
      makeReq(),
      null
    )

    expect(redirect).toBe("/reaccept-terms?returnTo=%2Fdashboard&doc=customer")
  })

  it("requires supplier doc only for SUPPLIER role", () => {
    expect(getRequiredDocuments("CUSTOMER")).toEqual(["customer", "privacy"])
    expect(getRequiredDocuments("SUPPLIER")).toEqual(["customer", "privacy", "supplier"])
    expect(getRequiredDocuments("AFFILIATE")).toEqual(["customer", "privacy", "affiliate"])
  })

  it("falls back to legacy merchant gate when feature flag is off", async () => {
    isLegalGateV2EnabledSyncMock.mockReturnValue(false)
    isLegalGateV2EnabledMock.mockResolvedValue(false)

    const req = makeReq()
    const token = { termsAcceptedVersion: "conditions-fournisseur:2026-06-01" }

    expect(legalGateOk(req, "SUPPLIER", token as never)).toBe(false)
    expect(merchantTermsGateOk(req, "SUPPLIER", token as never)).toBe(false)

    const redirect = await checkLegalGate(
      { id: "user_1", role: "SUPPLIER" },
      "/dashboard/supplier",
      req,
      token as never
    )

    expect(redirect).toContain("/reaccept-terms")
    expect(findFirstMissingDocumentSlugMock).not.toHaveBeenCalled()
  })

  it("skips DB check when legal cookie hash matches JWT", () => {
    const versionIds = ["ver_a", "ver_b"]
    const hash = computeLegalGateHash(versionIds)
    const req = makeReq(hash)
    const token = { legalGateHash: hash }

    expect(legalGateCookieOk(req, token as never)).toBe(true)
    expect(legalGateOk(req, "CUSTOMER", token as never)).toBe(true)
  })
})
