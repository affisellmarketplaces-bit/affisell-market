import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  aiMission: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  product: { findMany: vi.fn() },
  affiliateProduct: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const scrapeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/supplier-import-url-handler", () => ({ scrapeSupplierProductFromUrl: scrapeMock }))
vi.mock("@/lib/supplier-dashboard-analytics", () => ({ getSupplierAnalytics: vi.fn() }))
vi.mock("@/lib/affiliate-dashboard-analytics", () => ({ loadAffiliateDashboardAnalytics: vi.fn() }))

import {
  generateAiConnectionPlainKey,
  hashAiConnectionKey,
  isAiConnectionPlainKey,
} from "@/lib/ai-connect/keys"
import { handleMcpMessage } from "@/lib/ai-connect/mcp"

const supplier = { keyId: "key-1", userId: "sup-1", role: "SUPPLIER" }
const affiliate = { keyId: "key-2", userId: "aff-1", role: "AFFILIATE" }
const call = (name: string, args: unknown = {}, id = 1) => ({
  jsonrpc: "2.0" as const,
  id,
  method: "tools/call",
  params: { name, arguments: args },
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  prismaMock.aiMission.create.mockResolvedValue({ id: "m-1" })
  prismaMock.aiMission.update.mockResolvedValue({})
})

describe("ai connection keys", () => {
  it("generates recognisable, hashed-at-rest keys", () => {
    const k = generateAiConnectionPlainKey()
    expect(isAiConnectionPlainKey(k)).toBe(true)
    expect(isAiConnectionPlainKey("afs_ext_" + "x".repeat(30))).toBe(false)
    expect(hashAiConnectionKey(k)).toBe(hashAiConnectionKey(k))
    expect(hashAiConnectionKey(k)).not.toContain(k)
  })
})

describe("MCP protocol", () => {
  const deps = { schedule: vi.fn() }

  it("answers initialize and stays silent on notifications", async () => {
    const init = await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      supplier,
      deps
    )
    expect(init).toMatchObject({ result: { protocolVersion: "2025-03-26", serverInfo: { name: "affisell" } } })
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, supplier, deps)).toBeNull()
  })

  it("only lists tools the role may use", async () => {
    const names = async (p: typeof supplier) => {
      const r = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, p, deps)) as {
        result: { tools: Array<{ name: string }> }
      }
      return r.result.tools.map((t) => t.name)
    }
    expect(await names(supplier)).toContain("preview_product_import")
    expect(await names(affiliate)).not.toContain("preview_product_import")
    expect(await names(affiliate)).toContain("list_products")
  })

  it("rejects unknown tools and role-forbidden tools", async () => {
    expect(await handleMcpMessage(call("nope"), supplier, deps)).toMatchObject({ error: { code: -32602 } })
    const r = await handleMcpMessage(call("preview_product_import", { url: "https://x.example/p" }), affiliate, deps)
    expect(r).toMatchObject({ error: { code: -32602 } })
    expect(prismaMock.aiMission.create).not.toHaveBeenCalled()
  })

  it("reports invalid arguments as a tool error without logging a mission", async () => {
    const r = (await handleMcpMessage(call("list_products", { limit: 9999 }), supplier, deps)) as {
      result: { isError?: boolean }
    }
    expect(r.result.isError).toBe(true)
    expect(prismaMock.aiMission.create).not.toHaveBeenCalled()
  })
})

describe("tool isolation", () => {
  const deps = { schedule: vi.fn() }

  it("scopes supplier reads to the key owner, never to model-supplied ids", async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    await handleMcpMessage(call("list_products", { limit: 5, supplierId: "someone-else" }), supplier, deps)
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supplierId: "sup-1" }, take: 5 })
    )
  })

  it("scopes order reads by role and never selects buyer data", async () => {
    prismaMock.order.findMany.mockResolvedValue([])
    await handleMcpMessage(call("list_recent_orders"), affiliate, deps)
    const arg = prismaMock.order.findMany.mock.calls[0]![0] as { where: unknown; select: Record<string, boolean> }
    expect(arg.where).toEqual({ affiliateId: "aff-1" })
    expect(Object.keys(arg.select).sort()).toEqual(["createdAt", "id", "productId", "quantity", "status"])
  })

  it("get_mission only sees the caller's own missions", async () => {
    prismaMock.aiMission.findFirst.mockResolvedValue(null)
    const r = (await handleMcpMessage(call("get_mission", { missionId: "m-x" }), supplier, deps)) as {
      result: { isError?: boolean }
    }
    expect(prismaMock.aiMission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m-x", userId: "sup-1" } })
    )
    expect(r.result.isError).toBe(true)
  })
})

describe("async import mission", () => {
  it("returns a mission id immediately and finishes in the background", async () => {
    scrapeMock.mockResolvedValue({
      ok: true,
      platform: "cj",
      warnings: [],
      product: {
        title: "T", description: "D", price: 5, currency: "EUR", images: ["i"], variants: [], brand: "", category: "",
      },
    })
    let task: (() => Promise<void>) | undefined
    const r = (await handleMcpMessage(call("preview_product_import", { url: "https://cjdropshipping.com/product/x" }), supplier, {
      schedule: (t) => {
        task = t
      },
    })) as { result: { content: Array<{ text: string }> } }
    expect(JSON.parse(r.result.content[0]!.text)).toMatchObject({ missionId: "m-1", status: "queued" })
    expect(scrapeMock).not.toHaveBeenCalled()

    await task!()
    expect(scrapeMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.aiMission.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "done" }) })
    )
  })

  it("refuses private/internal URLs (SSRF) and marks the mission failed", async () => {
    let task: (() => Promise<void>) | undefined
    await handleMcpMessage(call("preview_product_import", { url: "https://localhost/admin" }), supplier, {
      schedule: (t) => {
        task = t
      },
    })
    await task!()
    expect(scrapeMock).not.toHaveBeenCalled()
    expect(prismaMock.aiMission.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", error: expect.stringContaining("Refused URL") }) })
    )
  })

  it("never leaks internal error details to the AI", async () => {
    scrapeMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432 postgres://user:pw@db"))
    let task: (() => Promise<void>) | undefined
    await handleMcpMessage(call("preview_product_import", { url: "https://cjdropshipping.com/product/x" }), supplier, {
      schedule: (t) => {
        task = t
      },
    })
    await task!()
    const last = prismaMock.aiMission.update.mock.calls.at(-1)![0] as { data: { error: string } }
    expect(last.data.error).toBe("Internal error while running the tool")
  })
})
