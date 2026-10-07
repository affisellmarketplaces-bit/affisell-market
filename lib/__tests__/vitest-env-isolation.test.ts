import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

import { parse } from "dotenv"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ISOLATED_ENV_KEYS } from "../../scripts/build-isolated.mjs"

/**
 * A test must not see the developer's secrets — CI runs the suite with none. Before vitest-env/no-real-datastores.ts,
 * `@prisma/client` loaded the repository's `.env` (production DATABASE_URL + ENCRYPTION_KEY) into every test process, and
 * lib/__tests__/aliexpress-oauth-token-exchange.test.ts wrote fake AliExpress tokens into the PRODUCTION database.
 */

const DB_TESTS = process.env.RUN_DB_TESTS === "1"
const envFile = resolve(process.cwd(), ".env")
const secretsOnThisMachine = existsSync(envFile) ? Object.keys(parse(readFileSync(envFile))) : []

describe("the test process carries no secret from the repository's .env", () => {
  it("setup file is wired into vitest.config.ts", () => {
    const config = readFileSync("vitest.config.ts", "utf8")
    expect(config).toMatch(/setupFiles:\s*\[[^\]]*vitest-env\/no-real-datastores\.ts/)
  })

  it.skipIf(secretsOnThisMachine.length === 0)("every key of .env is DEFINED (empty unless a test set it), so no loader can fill it in", () => {
    for (const key of secretsOnThisMachine) expect(Object.prototype.hasOwnProperty.call(process.env, key), key).toBe(true)
  })

  it.skipIf(secretsOnThisMachine.length === 0)("…and nothing from it has a value: no database URL, no token, no encryption key", () => {
    const withValue = secretsOnThisMachine.filter((key) => (process.env[key] ?? "") !== "" && !DB_TESTS)
    // Keys a test of THIS file or Vitest itself may legitimately define are not in .env, so this list must be empty.
    expect(withValue).toEqual([])
  })

  it.skipIf(DB_TESTS)("no database or cache credential is visible, wherever it would have come from", () => {
    for (const key of ISOLATED_ENV_KEYS) expect(process.env[key] ?? "", key).toBe("")
    expect(process.env.ENCRYPTION_KEY ?? "").toBe("")
  })

  it.skipIf(DB_TESTS)("importing @prisma/client — which used to load .env — fills nothing back in", async () => {
    await import("@prisma/client")
    for (const key of [...ISOLATED_ENV_KEYS, "ENCRYPTION_KEY"]) expect(process.env[key] ?? "", key).toBe("")
    for (const key of secretsOnThisMachine) expect(process.env[key] ?? "", key).toBe("")
  })

  it.skipIf(DB_TESTS)("a client created inside a test has no URL to connect to, so it cannot reach the production database", () => {
    expect(process.env.DATABASE_URL ?? "").toBe("")
    expect(process.env.DATABASE_URL_UNPOOLED ?? "").toBe("")
    expect(process.env.DIRECT_URL ?? "").toBe("")
  })
})

describe("REGRESSION — the AliExpress incident: the real token store cannot write from a test", () => {
  afterEach(() => vi.restoreAllMocks())

  it.skipIf(DB_TESTS)("the REAL saveAliExpressTokens refuses (no encryption key) and never touches Prisma — it used to write `…_iop` tokens into production", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const { saveAliExpressTokens } = await import("@/lib/aliexpress-token-store")
    const result = await saveAliExpressTokens({ accessToken: "access_iop", refreshToken: "refresh_iop" })
    expect(result).toEqual({ ok: false, error: "ENCRYPTION_KEY_missing" })
    expect(log).toHaveBeenCalledWith("[aliexpress-token-store]", expect.objectContaining({ result: "skip_persist" }))
    // No Prisma client was even created: `[prisma] client_created` / `[db]` are only logged when one is.
    expect(log.mock.calls.filter(([tag]) => tag === "[prisma]" || tag === "[db]")).toEqual([])
  })

  it("the exchange test replaces the token store (hermetic, whatever the environment)", () => {
    const source = readFileSync("lib/__tests__/aliexpress-oauth-token-exchange.test.ts", "utf8")
    expect(source).toMatch(/vi\.mock\("@\/lib\/aliexpress-token-store"/)
  })

  it("no other test reaches the real token store: each one replaces it (vi.mock / vi.doMock) or takes only the pure `expiresWithinMs`", () => {
    // Every test file that mentions the store must either mock it or mock prisma, so it cannot reach a real database.
    const offenders = readdirSync("lib/__tests__")
      .filter((name) => name.endsWith(".test.ts"))
      .filter((name) => {
        const text = readFileSync(`lib/__tests__/${name}`, "utf8")
        if (!/aliexpress-token-store|saveAliExpressTokens|persistExchangedTokens|exchangeAliExpressAuthorizationCode/.test(text)) return false
        if (name === "vitest-env-isolation.test.ts") return false // this file calls the real store ON PURPOSE, with no key: it refuses before any I/O
        if (/vi\.(do)?[mM]ock\(\s*["']@\/lib\/(aliexpress-token-store|prisma)["']/.test(text)) return false // replaced by a stand-in
        // Pure helper only (no I/O): `expiresWithinMs` is the single symbol it takes from the store.
        const symbols = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/aliexpress-token-store["']/g)].flatMap((m) => m[1]!.split(",").map((x) => x.trim()).filter(Boolean))
        const mentionsOtherStoreApi = /saveAliExpressTokens|persistExchangedTokens|exchangeAliExpressAuthorizationCode|loadAliExpressTokenState/.test(text)
        if (symbols.length > 0 && symbols.every((x) => x === "expiresWithinMs") && !mentionsOtherStoreApi) return false
        return true
      })
    expect(offenders).toEqual([])
  })
})
