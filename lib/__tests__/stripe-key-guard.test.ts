import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ALLOW_LIVE_STRIPE_VARIABLE,
  StripeLiveKeyOutsideProductionError,
  assertStripeKeyAllowed,
  classifyStripeKey,
  isLiveStripeKeyAllowed,
} from "@/lib/stripe-key-guard"

// Obviously fake: the shapes are what matter. Built by concatenation so that no secret scanner mistakes this file for a leak.
const LIVE = "sk_" + "live_" + "FAKEFAKEFAKEFAKEFAKE0000"
const LIVE_RESTRICTED = "rk_" + "live_" + "FAKEFAKEFAKEFAKEFAKE0000"
const TEST = "sk_" + "test_" + "FAKEFAKEFAKEFAKEFAKE0000"

const PRODUCTION = { VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" }
const PREVIEW = { VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production" }

describe("classifyStripeKey", () => {
  it.each([
    [LIVE, "live"],
    [LIVE_RESTRICTED, "live"],
    [`  ${LIVE}  `, "live"],
    [TEST, "test"],
    ["rk_" + "test_" + "abc", "test"],
    ["", "unknown"],
    [undefined, "unknown"],
    ["pk_" + "live_abc", "unknown"], // a publishable key is not a secret key
    ["whsec_abc", "unknown"],
  ])("%s → %s", (key, expected) => {
    expect(classifyStripeKey(key)).toBe(expected)
  })
})

describe("assertStripeKeyAllowed — a LIVE key never runs outside production", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("allows a live key in production, and the Railway worker (NODE_ENV=production, no VERCEL_ENV)", () => {
    expect(() => assertStripeKeyAllowed(LIVE, PRODUCTION)).not.toThrow()
    expect(() => assertStripeKeyAllowed(LIVE, { NODE_ENV: "production" })).not.toThrow()
  })

  it("REFUSES a live key on a Preview — the bug: nothing prevented a Preview from charging real cards", () => {
    expect(() => assertStripeKeyAllowed(LIVE, PREVIEW)).toThrow(StripeLiveKeyOutsideProductionError)
    expect(() => assertStripeKeyAllowed(LIVE_RESTRICTED, PREVIEW)).toThrow(StripeLiveKeyOutsideProductionError)
  })

  it("refuses it on Vercel development, on a laptop and in tests", () => {
    expect(() => assertStripeKeyAllowed(LIVE, { VERCEL: "1", VERCEL_ENV: "development", NODE_ENV: "development" })).toThrow(
      StripeLiveKeyOutsideProductionError
    )
    expect(() => assertStripeKeyAllowed(LIVE, { NODE_ENV: "development" })).toThrow(StripeLiveKeyOutsideProductionError)
    expect(() => assertStripeKeyAllowed(LIVE, { NODE_ENV: "test" })).toThrow(StripeLiveKeyOutsideProductionError)
  })

  it("a test key is fine everywhere, and a missing / unknown key is not this guard's business", () => {
    for (const env of [PRODUCTION, PREVIEW, { NODE_ENV: "development" }]) {
      expect(() => assertStripeKeyAllowed(TEST, env)).not.toThrow()
      expect(() => assertStripeKeyAllowed(undefined, env)).not.toThrow()
      expect(() => assertStripeKeyAllowed("not-a-stripe-key", env)).not.toThrow()
    }
  })

  it("never shows the key — not in the error, not in the log", () => {
    let error: unknown
    try {
      assertStripeKeyAllowed(LIVE, PREVIEW)
    } catch (e) {
      error = e
    }
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    for (const text of [String((error as Error).message), logged]) {
      expect(text).not.toContain(LIVE)
      expect(text).not.toContain("FAKEFAKE")
      expect(text).not.toMatch(/sk_live|rk_live/)
    }
    expect((error as StripeLiveKeyOutsideProductionError).environment).toBe("preview")
  })

  describe("the developer-machine escape hatch", () => {
    it("lets a laptop deliberately probe live mode", () => {
      expect(isLiveStripeKeyAllowed({ NODE_ENV: "development", [ALLOW_LIVE_STRIPE_VARIABLE]: "1" })).toBe(true)
      expect(() => assertStripeKeyAllowed(LIVE, { NODE_ENV: "development", [ALLOW_LIVE_STRIPE_VARIABLE]: "1" })).not.toThrow()
    })

    it("is IGNORED on every Vercel deployment — it cannot re-open the hole on a Preview", () => {
      expect(isLiveStripeKeyAllowed({ ...PREVIEW, [ALLOW_LIVE_STRIPE_VARIABLE]: "1" })).toBe(false)
      expect(() => assertStripeKeyAllowed(LIVE, { ...PREVIEW, [ALLOW_LIVE_STRIPE_VARIABLE]: "1" })).toThrow(StripeLiveKeyOutsideProductionError)
      expect(() =>
        assertStripeKeyAllowed(LIVE, { VERCEL: "1", VERCEL_ENV: "development", [ALLOW_LIVE_STRIPE_VARIABLE]: "1" })
      ).toThrow(StripeLiveKeyOutsideProductionError)
    })

    it("only the exact value 1 counts", () => {
      for (const v of ["true", "yes", "0", ""]) {
        expect(isLiveStripeKeyAllowed({ NODE_ENV: "development", [ALLOW_LIVE_STRIPE_VARIABLE]: v })).toBe(false)
      }
    })
  })
})

describe("getStripeClient is guarded", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("builds no client for a live key outside production (a Preview), but builds one for a test key", async () => {
    const { getStripeClient } = await import("@/lib/stripe")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE)
    expect(() => getStripeClient()).toThrow(StripeLiveKeyOutsideProductionError)

    vi.stubEnv("STRIPE_SECRET_KEY", TEST)
    expect(getStripeClient()).toBeTruthy()
  })

  it("still builds a client with a live key in production", async () => {
    const { getStripeClient } = await import("@/lib/stripe")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE)
    expect(getStripeClient()).toBeTruthy()
  })

  it("lib/stripe.ts is the only place the application builds a Stripe client from a secret key (a second constructor would bypass the guard)", () => {
    const source = readFileSync(join(process.cwd(), "lib/stripe.ts"), "utf8")
    expect(source).toContain("assertStripeKeyAllowed(key)")
    expect(source.indexOf("assertStripeKeyAllowed(key)")).toBeLessThan(source.indexOf("new Stripe("))

    const root = process.cwd()
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry === "__tests__" || entry.startsWith(".")) continue
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path, out)
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
      }
      return out
    }
    const constructors = ["lib", "app", "workers", "inngest"]
      .flatMap((dir) => walk(join(root, dir)))
      .filter((file) => /new Stripe\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file))
    expect(constructors).toEqual(["lib/stripe.ts"])
  })
})
