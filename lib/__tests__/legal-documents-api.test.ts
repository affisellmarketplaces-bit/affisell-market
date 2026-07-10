import { beforeEach, describe, expect, it, vi } from "vitest"

const { listPublicLegalDocumentsMock } = vi.hoisted(() => ({
  listPublicLegalDocumentsMock: vi.fn(),
}))

vi.mock("@/lib/legal/public-documents-catalog", () => ({
  listPublicLegalDocuments: listPublicLegalDocumentsMock,
}))

import { GET } from "@/app/api/legal/documents/route"
import { devLocalhostUrl } from "@/lib/dev-localhost-url"

const mockDocuments = [
  {
    slug: "customer",
    name: "CGU",
    version: "1.0.0",
    hash: "fb236ee2c5db695aa246bc51cf60d4d2cb2bf409f6513e89dfe3c742c6b1bbfb",
    effectiveDate: "2026-07-09",
    downloadUrl: "/api/legal/document/customer?locale=fr",
  },
  {
    slug: "privacy",
    name: "Politique Confidentialité",
    version: "1.0.0",
    hash: "78d004c56b707d210ce3f45b87c26d9c083566aa7f9052dec4ad919ea0b5ff16",
    effectiveDate: "2026-07-09",
    downloadUrl: "/api/legal/document/privacy?locale=fr",
  },
]

describe("GET /api/legal/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicLegalDocumentsMock.mockResolvedValue(mockDocuments)
  })

  it("returns public legal document summaries", async () => {
    const res = await GET(new Request(devLocalhostUrl("/api/legal/documents?locale=fr")))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ slug: string; hash: string }>
    expect(body).toHaveLength(2)
    expect(body[0]?.slug).toBe("customer")
    expect(body[0]?.hash).toMatch(/^fb236ee2/)
    expect(listPublicLegalDocumentsMock).toHaveBeenCalledWith("fr")
  })

  it("sets short public cache", async () => {
    const res = await GET(new Request(devLocalhostUrl("/api/legal/documents")))
    expect(res.headers.get("Cache-Control")).toContain("max-age=300")
    expect(res.headers.get("Content-Type")).toContain("application/json")
  })

  it("returns JSON on catalog failure", async () => {
    listPublicLegalDocumentsMock.mockRejectedValueOnce(new Error("db unavailable"))

    const res = await GET(new Request(devLocalhostUrl("/api/legal/documents")))
    expect(res.status).toBe(500)
    expect(res.headers.get("Content-Type")).toContain("application/json")
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("Failed to load legal documents")
  })
})
