import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    legalDocument: {
      findUnique: vi.fn(),
    },
    legalVersion: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { GET } from "@/app/api/legal/document/[slug]/route"
import { devLocalhostUrl } from "@/lib/dev-localhost-url"

const CGU_CONTENT = "# Conditions Générales d'Utilisation\n\nContenu CGU test."

const mockDocument = {
  id: "doc_cgu",
  type: "CGU",
  title: "Conditions Générales d'Utilisation",
  slug: "customer",
  category: "agreement",
  requiresAccept: true,
  currentVersionId: "ver_fr",
  createdAt: new Date("2026-07-09"),
  updatedAt: new Date("2026-07-09"),
}

const mockFrVersion = {
  id: "ver_fr",
  documentId: "doc_cgu",
  version: "1.0.0",
  language: "fr",
  title: "Conditions Générales d'Utilisation",
  content: CGU_CONTENT,
  contentHash: "abc123",
  publishedAt: new Date("2026-07-09T10:00:00.000Z"),
  publishedBy: "system:seed",
  changelog: "Initial import",
  effectiveAt: new Date("2026-07-09T10:00:00.000Z"),
  deprecatedAt: null,
}

function makeGetRequest(slug: string, locale: string) {
  return new Request(devLocalhostUrl(`/api/legal/document/${slug}?locale=${locale}`))
}

describe("GET /api/legal/document/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 200 with DB content for customer?locale=fr", async () => {
    prismaMock.legalDocument.findUnique.mockResolvedValue({
      ...mockDocument,
      currentVersion: mockFrVersion,
    })
    prismaMock.legalVersion.findUnique.mockResolvedValue(null)

    const res = await GET(makeGetRequest("customer", "fr"), {
      params: Promise.resolve({ slug: "customer" }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      meta: { slug: string; version: string; contentHash: string; source: string }
      content: string
    }
    expect(body.meta.slug).toBe("customer")
    expect(body.meta.version).toBe("1.0.0")
    expect(body.meta.source).toBe("db")
    expect(body.content).toBe(CGU_CONTENT)
  })

  it("returns 404 for unknown locale when DB has no match and no legacy file", async () => {
    prismaMock.legalDocument.findUnique.mockResolvedValue({
      ...mockDocument,
      currentVersion: mockFrVersion,
    })
    prismaMock.legalVersion.findUnique.mockResolvedValue(null)

    const res = await GET(makeGetRequest("customer", "xx"), {
      params: Promise.resolve({ slug: "customer" }),
    })

    expect(res.status).toBe(404)
  })

  it("sets no-store cache for agreements with requiresAccept", async () => {
    prismaMock.legalDocument.findUnique.mockResolvedValue({
      ...mockDocument,
      currentVersion: mockFrVersion,
    })
    prismaMock.legalVersion.findUnique.mockResolvedValue(null)

    const res = await GET(makeGetRequest("customer", "fr"), {
      params: Promise.resolve({ slug: "customer" }),
    })

    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})
