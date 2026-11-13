import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ getToken: vi.fn() }))

vi.mock("next-auth/jwt", async (importActual) => ({
  ...(await importActual<typeof import("next-auth/jwt")>()),
  getToken: m.getToken,
}))
// next-intl's ESM middleware cannot resolve `next/server` outside Next's bundler, and its locale routing is not what is
// tested here: a request that gets past the guards simply continues.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server")
  return { default: () => () => NextResponse.next() }
})
vi.mock("@/lib/security/humanoid-shield", () => ({
  HumanoidShield: {
    analyze: () => ({ ip: "203.0.113.5", score: 0, isHuman: true, threats: [], action: "ALLOW" }),
    log: () => undefined,
  },
}))
vi.mock("@/lib/radar/gate", () => ({ radarDisabledResponse: () => null }))
vi.mock("@/lib/middleware-custom-domain", () => ({ tryCustomDomainMiddleware: async () => null }))
vi.mock("@/lib/platform-canonical-url", () => ({ canonicalPlatformRedirectUrl: () => null }))

const SECRET = "test-secret-with-enough-length-0123456789"
const MALFORMED_BEARER = { authorization: "Bearer %E0%A4%A" }

type Proxy = (req: NextRequest) => Promise<Response>

/** `proxy.ts` reads the secret when it is imported, so each scenario gets a fresh copy of the module. */
async function loadProxy(env: { AUTH_SECRET?: string; NEXTAUTH_SECRET?: string } = {}): Promise<Proxy> {
  vi.resetModules()
  vi.stubEnv("AUTH_SECRET", env.AUTH_SECRET ?? "")
  vi.stubEnv("NEXTAUTH_SECRET", env.NEXTAUTH_SECRET ?? "")
  const mod = await import("@/proxy")
  return mod.proxy as Proxy
}

function page(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://affisell.test${path}`, { headers })
}

function redirectPath(res: Response): string | null {
  const location = res.headers.get("location")
  return location ? new URL(location, "https://affisell.test").pathname : null
}

beforeEach(() => {
  m.getToken.mockReset()
  m.getToken.mockResolvedValue(null)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("proxy: the home page reads the session without ever failing", () => {
  it("does not answer 500 to a malformed Bearer header: the visitor is simply anonymous", async () => {
    const actual = await vi.importActual<typeof import("next-auth/jwt")>("next-auth/jwt")
    m.getToken.mockImplementation(actual.getToken)
    const proxy = await loadProxy({ AUTH_SECRET: SECRET })

    const res = await proxy(page("/", MALFORMED_BEARER))

    expect(res.status).toBeLessThan(500)
    expect(redirectPath(res)).toBeNull()
  })

  it("still sends a signed-in affiliate / supplier from the home page to their dashboard", async () => {
    const proxy = await loadProxy({ AUTH_SECRET: SECRET })

    m.getToken.mockResolvedValue({ sub: "user_1", role: "AFFILIATE" })
    expect(redirectPath(await proxy(page("/")))).toBe("/dashboard/affiliate")
    m.getToken.mockResolvedValue({ sub: "user_2", role: "SUPPLIER" })
    expect(redirectPath(await proxy(page("/")))).toBe("/dashboard/supplier")
    m.getToken.mockResolvedValue({ sub: "user_3", role: "CUSTOMER" })
    expect(redirectPath(await proxy(page("/")))).toBeNull()
  })

  it("uses the same secret as Auth.js: an EMPTY AUTH_SECRET does not hide a real NEXTAUTH_SECRET", async () => {
    // before: `AUTH_SECRET ?? NEXTAUTH_SECRET` chose "", the proxy skipped the session and nobody was redirected
    const proxy = await loadProxy({ AUTH_SECRET: "", NEXTAUTH_SECRET: SECRET })
    m.getToken.mockResolvedValue({ sub: "user_1", role: "AFFILIATE" })

    expect(redirectPath(await proxy(page("/")))).toBe("/dashboard/affiliate")
    expect(m.getToken).toHaveBeenCalledWith(expect.objectContaining({ secret: SECRET }))
  })

  it("without any secret every visitor is anonymous: no session is read and nothing throws", async () => {
    const proxy = await loadProxy({})
    m.getToken.mockResolvedValue({ sub: "user_1", role: "AFFILIATE" })

    const res = await proxy(page("/"))

    expect(redirectPath(res)).toBeNull()
    expect(m.getToken).not.toHaveBeenCalled()
  })
})

describe("proxy: pages outside the reserved first segments (the guard block's only reachable paths)", () => {
  it("does not answer 500 to a malformed Bearer header", async () => {
    const actual = await vi.importActual<typeof import("next-auth/jwt")>("next-auth/jwt")
    m.getToken.mockImplementation(actual.getToken)
    const proxy = await loadProxy({ AUTH_SECRET: SECRET })

    const res = await proxy(page("/zz-not-a-reserved-segment", MALFORMED_BEARER))

    expect(res.status).toBeLessThan(500)
  })

  it("runs without a secret as an anonymous visitor", async () => {
    const proxy = await loadProxy({})

    const res = await proxy(page("/zz-not-a-reserved-segment"))

    expect(res.status).toBeLessThan(400)
    expect(m.getToken).not.toHaveBeenCalled()
  })
})

describe("proxy: a missing secret is reported, a present one is not", () => {
  it("logs once, at load, that no secret is configured", async () => {
    await loadProxy({})
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith("[proxy]", expect.objectContaining({ result: "auth_secret_missing" }))
  })

  it("stays quiet when a secret is configured", async () => {
    await loadProxy({ NEXTAUTH_SECRET: SECRET })
    expect(console.error).not.toHaveBeenCalled()
  })
})

/**
 * CHARACTERISATION — not a wish. `proxy.ts` has a block that redirects anonymous visitors away from the supplier,
 * affiliate, agent, admin, CRM and buyer-account areas (and enforces the legal re-acceptance gate), but since
 * 2026-05-21 `isStaticAppPathname` (first segment "dashboard" / "admin" / "crm" / "marketplace" …) returns BEFORE it:
 * those areas are protected by their own layouts, pages and route handlers, not by the proxy. This test pins that fact
 * so that wiring the proxy guard back in is a decision someone takes on purpose (and then updates this test).
 */
describe("proxy: protected areas are NOT guarded by the proxy today (see AGENTS.md)", () => {
  it.each(["/dashboard/supplier", "/dashboard/affiliate", "/dashboard/agent", "/admin", "/crm", "/marketplace/account"])(
    "%s passes through the proxy for an anonymous visitor (the page itself must refuse)",
    async (path) => {
      const proxy = await loadProxy({ AUTH_SECRET: SECRET })

      const res = await proxy(page(path))

      expect(redirectPath(res)).toBeNull()
      expect(res.status).toBe(200)
    }
  )
})
