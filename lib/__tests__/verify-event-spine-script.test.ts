import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * Regression: `verify:event-spine` once connected to PRODUCTION when run without a URL, because importing `@prisma/client`
 * loads the repository's `.env` (which holds the production URL) into process.env when the variable is unset. The script
 * must capture the explicit URL FIRST and import Prisma only afterwards.
 *
 * These tests can never reach a real database, even if the fix regressed: the subprocess gets `DATABASE_URL=""`
 * (defined but empty — dotenv never overrides a defined variable) or an unreachable local URL.
 */

const SCRIPT = readFileSync("scripts/verify-event-spine.ts", "utf8")

function run(env: Record<string, string>, ...args: string[]) {
  return spawnSync("npx", ["tsx", "scripts/verify-event-spine.ts", ...args], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 60_000,
  })
}

describe("scripts/verify-event-spine.ts never falls back to a .env database", () => {
  it("does not import @prisma/client statically (the import itself loads .env)", () => {
    expect(SCRIPT).not.toMatch(/^import[^\n]*from\s+["']@prisma\/client["']/m)
    expect(SCRIPT).toContain('await import("@prisma/client")')
  })

  it("captures the explicit URL, and refuses when there is none, BEFORE Prisma is loaded", () => {
    const capture = SCRIPT.indexOf("const EXPLICIT_DATABASE_URL = process.env.DATABASE_URL")
    const refusal = SCRIPT.indexOf("DATABASE_URL is not set")
    const dynamicImport = SCRIPT.indexOf('await import("@prisma/client")')
    expect(capture).toBeGreaterThan(-1)
    expect(capture).toBeLessThan(refusal)
    expect(refusal).toBeLessThan(dynamicImport)
  })

  it("without a URL it stops with exit 2 and says why", () => {
    const result = run({ DATABASE_URL: "" })
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/DATABASE_URL is not set/)
    expect(result.stdout).not.toMatch(/Target database/)
  }, 90_000)

  it("with an explicit URL it uses THAT one (here an unreachable one → exit 3), and names it as the target", () => {
    const result = run({ DATABASE_URL: "postgresql://nobody:nobody@127.0.0.1:9/none?connect_timeout=2" })
    expect(result.status).toBe(3)
    expect(result.stdout).toMatch(/Target database: .*127/)
    expect(result.stdout + result.stderr).not.toMatch(/misty-sea|shy-wind/)
  }, 90_000)

  it("rejects an invalid --expect before doing anything", () => {
    const result = run({ DATABASE_URL: "" }, "--expect", "maybe")
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/--expect must be/)
  }, 90_000)
})
