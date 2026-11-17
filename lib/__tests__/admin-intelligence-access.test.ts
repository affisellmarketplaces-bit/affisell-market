import { beforeEach, describe, expect, it, vi } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * The founder cockpit (/admin/intelligence) is reserved to ADMIN: it shows the whole marketplace (orders, suppliers,
 * disputes, resellers' losses). Two independent locks are tested here — the admin layout AND the page itself — so that
 * moving the page out of /admin, or a layout regression, does not open it. And nothing outside the page imports the
 * collector (no API route serves it).
 */
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  load: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: vi.fn() }))
vi.mock("@/lib/strategic-intelligence/collect.server", () => ({ loadIntelligenceCockpit: m.load }))
vi.mock("@/components/admin/admin-layout-chrome", () => ({ AdminLayoutChrome: () => null }))

const cockpit = { generatedAt: "2026-11-17T00:00:00.000Z", signals: [], sources: [], coverage: [], collectors: [] }

beforeEach(() => {
  m.auth.mockReset()
  m.load.mockReset().mockResolvedValue(cockpit)
  m.redirect.mockClear()
})

const session = (role?: string) => ({ user: { id: "u1", email: "x@example.test", role }, expires: "2099-01-01" })

describe("/admin/intelligence — reserved to ADMIN", () => {
  it.each([
    ["anonymous", null, "/login/admin?callbackUrl=/admin/intelligence"],
    ["session without user id", { user: {} }, "/login/admin?callbackUrl=/admin/intelligence"],
    ["affiliate", session("AFFILIATE"), "/"],
    ["supplier", session("SUPPLIER"), "/"],
    ["buyer", session("CUSTOMER"), "/"],
    ["no role", session(undefined), "/"],
  ])("page refuses %s and never reads the cockpit", async (_label, s, target) => {
    m.auth.mockResolvedValue(s)
    const { default: Page } = await import("@/app/admin/intelligence/page")
    await expect(Page()).rejects.toThrow(`NEXT_REDIRECT:${target}`)
    expect(m.load).not.toHaveBeenCalled()
  })

  it("page renders for an ADMIN", async () => {
    m.auth.mockResolvedValue(session("ADMIN"))
    const { default: Page } = await import("@/app/admin/intelligence/page")
    await expect(Page()).resolves.toBeTruthy()
    expect(m.load).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["anonymous", null],
    ["supplier", session("SUPPLIER")],
  ])("the admin layout refuses %s too", async (_label, s) => {
    m.auth.mockResolvedValue(s)
    const { default: Layout } = await import("@/app/admin/layout")
    await expect(Layout({ children: null })).rejects.toThrow(/NEXT_REDIRECT/)
  })

  it("nothing but the admin page imports the cockpit collector (no API route serves it)", () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name) && readFileSync(p, "utf8").includes("strategic-intelligence/collect.server")) hits.push(p)
      }
    }
    walk(join(process.cwd(), "app"))
    walk(join(process.cwd(), "components"))
    expect(hits.map((h) => h.replace(process.cwd() + "/", ""))).toEqual(["app/admin/intelligence/page.tsx"])
  })
})
