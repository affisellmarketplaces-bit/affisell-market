/**
 * DEC-11 / RSK-90 — the audit-package generator must never ship an environment file again.
 *
 * `prisma/env.local` (no leading dot) was tracked for months and ended up in `Affisell_Audit_Package.zip` because every
 * rule of `scripts/build-audit-package.mjs` only looked at names starting with ".env".
 *
 * The generator is NOT run here (it writes into the repository root and calls zip). Instead the test reads its source as
 * text, extracts the copy filter and the staging guard, and evaluates those two pure functions on decoy paths.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const SOURCE = readFileSync(path.resolve(process.cwd(), "scripts/build-audit-package.mjs"), "utf8")

/** Text of the `{ ... }` block that starts at `openIndex` (the generator's blocks contain no braces inside strings). */
function block(openIndex: number): string {
  let depth = 0
  for (let i = openIndex; i < SOURCE.length; i++) {
    if (SOURCE[i] === "{") depth++
    else if (SOURCE[i] === "}" && --depth === 0) return SOURCE.slice(openIndex, i + 1)
  }
  throw new Error("unbalanced block in generator source")
}

function setLiteral(name: string): Set<string> {
  const m = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(SOURCE)
  if (!m) throw new Error(`${name} not found`)
  return new Set([...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]))
}

const SKIP_DIR_NAMES = setLiteral("SKIP_DIR_NAMES")
const SKIP_FILE_NAMES = setLiteral("SKIP_FILE_NAMES")

const filterStart = SOURCE.indexOf("filter: (srcPath) => {")
if (filterStart < 0) throw new Error("copy filter not found")
const copyFilter = new Function(
  "SKIP_DIR_NAMES",
  "SKIP_FILE_NAMES",
  `return (srcPath) => ${block(SOURCE.indexOf("{", filterStart + "filter: (srcPath) =>".length))}`
)(SKIP_DIR_NAMES, SKIP_FILE_NAMES) as (srcPath: string) => boolean

const guardStart = SOURCE.indexOf("function isSensitiveStagedName(base) {")
if (guardStart < 0) throw new Error("staging guard not found")
const guardBody = block(SOURCE.indexOf("{", guardStart))
const isSensitiveStagedName = new Function(`return function isSensitiveStagedName(base) ${guardBody}`)() as (
  base: string
) => boolean

const ROOT = "/repo"
const kept = (rel: string) => copyFilter(`${ROOT}/${rel}`)

const SENSITIVE_PATHS = [
  "prisma/env.local", // the original incident
  "lib/env.local",
  "app/env.local",
  "prisma/env.production",
  "prisma/env.development",
  "prisma/env.test",
  "prisma/.env",
  "prisma/.env.local",
  "prisma/.env.staging",
  "prisma/.dev.vars",
  "prisma/.dev.vars.part1",
  "keys/server.pem",
  "keys/signing.key",
  "prisma/dev.db",
  "prisma/prisma/dev.db",
  "data/app.sqlite",
  "data/app.sqlite3",
  "scripts/migration-report.csv",
]

const LEGITIMATE_PATHS = [
  "lib/env.ts",
  "lib/env.pure.mjs",
  "lib/radar/env.ts",
  "apps/api/src/shared/env.ts",
  "lib/__tests__/env.test.ts",
  "prisma/schema.prisma",
  "prisma/migrations/20260430000000_baseline_schema/migration.sql",
  "lib/keep_canary.ts",
  "app/page.tsx",
  ".env.example",
  "docs/ENVIRONMENT.md",
]

describe("audit package — copy filter", () => {
  it.each(SENSITIVE_PATHS)("rejects %s", (rel) => {
    expect(kept(rel)).toBe(false)
  })

  it.each(LEGITIMATE_PATHS)("keeps %s", (rel) => {
    expect(kept(rel)).toBe(true)
  })

  it("rejects anything under a skipped directory", () => {
    expect(kept("node_modules/x/index.js")).toBe(false)
    expect(kept("medusa-backend/src/a.ts")).toBe(false)
    expect(kept("lib/.next/cache.js")).toBe(false)
  })

  it("lists the dot-less environment names explicitly (the cause of the incident)", () => {
    for (const name of ["env.local", "env.production", "env.development", "env.test"]) {
      expect(SKIP_FILE_NAMES.has(name)).toBe(true)
    }
  })
})

describe("audit package — staging guard (last line of defence)", () => {
  it.each(SENSITIVE_PATHS)("flags %s", (rel) => {
    expect(isSensitiveStagedName(rel.split("/").pop() as string)).toBe(true)
  })

  it.each(LEGITIMATE_PATHS)("does not flag %s", (rel) => {
    expect(isSensitiveStagedName(rel.split("/").pop() as string)).toBe(false)
  })

  it("agrees with the filter: nothing the guard flags is accepted by the filter", () => {
    for (const rel of SENSITIVE_PATHS) {
      expect(isSensitiveStagedName(rel.split("/").pop() as string)).toBe(true)
      expect(kept(rel)).toBe(false)
    }
  })

  it("is called before the zip is created", () => {
    const guardCall = SOURCE.indexOf("  assertNoSensitiveFiles()\n")
    const zipCall = SOURCE.indexOf("  createZip()\n")
    expect(guardCall).toBeGreaterThan(0)
    expect(zipCall).toBeGreaterThan(guardCall)
  })
})

describe("audit package — generator structure", () => {
  it("copies files in exactly the three known places and runs no other process than zip/unzip/find/du", () => {
    expect(SOURCE.match(/\bcpSync\(/g)).toHaveLength(3)
    expect(SOURCE.match(/\bexecSync\(/g)).toHaveLength(4)
    expect(SOURCE).not.toMatch(/\b(?:require|eval|spawn|spawnSync|execFile|execFileSync|fork)\s*\(/)
  })
})
