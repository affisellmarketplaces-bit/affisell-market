import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Wiring guards for the Phase 1 diagnostics (instrumentation entry point, client bundles, forbidden post-response mechanisms).
 * These read SOURCE files; nothing is executed.
 */

const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("instrumentation.ts", () => {
  const raw = readFileSync("instrumentation.ts", "utf8")
  const code = strip(raw)

  it("starts the heartbeat only in the Node runtime, inside try/catch, BEFORE the warm connect", () => {
    const nodeBranch = code.indexOf('process.env.NEXT_RUNTIME === "nodejs"')
    const edgeBranch = code.indexOf('process.env.NEXT_RUNTIME === "edge"')
    const start = code.indexOf("startRuntimeLiveness()")
    const tryAt = code.lastIndexOf("try {", start)
    const warm = code.indexOf("connectPrismaWithRetry()")
    expect(nodeBranch).toBeGreaterThan(-1)
    expect(start).toBeGreaterThan(nodeBranch)
    expect(start).toBeLessThan(edgeBranch)
    expect(tryAt).toBeGreaterThan(nodeBranch)
    expect(code.indexOf("catch", start)).toBeGreaterThan(start)
    expect(warm).toBeGreaterThan(start)
  })

  it("imports the diagnostics lazily (dynamic import), never at the top of the file, and calls it exactly once", () => {
    const staticImports = code.match(/^import .*$/gm) ?? []
    expect(staticImports).toEqual(['import * as Sentry from "@sentry/nextjs"'])
    expect(code.match(/import\("@\/lib\/runtime-liveness"\)/g)).toHaveLength(1)
    expect(code.match(/startRuntimeLiveness\(\)/g)).toHaveLength(1)
  })

  it("adds no post-response mechanism", () => {
    expect(code).not.toMatch(/\bafter\(|waitUntil/)
  })
})

describe("the diagnostic modules stay on the server", () => {
  it.each([["lib/prisma-diagnostics.ts"], ["lib/runtime-liveness.ts"]])('%s starts with import "server-only"', (file) => {
    expect(readFileSync(file, "utf8").startsWith('import "server-only"')).toBe(true)
  })

  it("no 'use client' module imports lib/prisma, lib/prisma-diagnostics or lib/runtime-liveness", () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__tests__") continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const head = readFileSync(full, "utf8").slice(0, 400)
          if (!/^\s*(["'])use client\1/m.test(head)) continue
          const source = readFileSync(full, "utf8")
          if (/from\s+["']@\/lib\/(prisma|prisma-diagnostics|runtime-liveness)["']/.test(source)) offenders.push(full)
        }
      }
    }
    for (const root of ["app", "components", "lib", "hooks"]) {
      try {
        walk(root)
      } catch {
        /* directory absent */
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("Phase 1 forbids post-response work and extra transport", () => {
  it.each([["lib/prisma-diagnostics.ts"], ["lib/runtime-liveness.ts"], ["lib/runtime-instance.ts"]])("%s", (file) => {
    const code = strip(readFileSync(file, "utf8"))
    expect(code).not.toMatch(/\bafter\(|waitUntil|from "next\/server"/)
    expect(code).not.toMatch(/fetch\(|node:http|node:https|node:net|XMLHttpRequest/)
  })

  it("lib/prisma.ts gained no after()/waitUntil()", () => {
    expect(strip(readFileSync("lib/prisma.ts", "utf8"))).not.toMatch(/\bafter\(|waitUntil/)
  })
})
