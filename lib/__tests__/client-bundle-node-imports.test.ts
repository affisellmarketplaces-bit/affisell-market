import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * A "use client" module is compiled for the BROWSER. If a value import chain from it reaches a module that imports
 * `node:async_hooks` (AsyncLocalStorage), the production build fails: Turbopack "chunking context does not support external
 * modules (request: node:async_hooks)" — found on the first CI build of the finalisation PR (lib/ai/usage-log.ts, reached through
 * supplier-optimize-variants → anthropic-client). `npm run check:client-prisma` only covers Prisma, so this is its sibling.
 *
 * Rules the scan mirrors from Next: `import type` and `import { type A }` are erased; a "use server" file is an RPC boundary
 * (its own imports never reach the client bundle).
 */

const ROOT = process.cwd()
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "medusa-backend", "Affisell_Audit_Package", ".claude", "__tests__", "e2e", "scripts"])
const EXTS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"]
const IMPORT_RE = /(?:^|\n)\s*(import|export)\s+(type\s+)?((?:[^'";]*?)\s+from\s+)?["']([^"']+)["']/g
const FORBIDDEN_IN_BROWSER = /^(node:)?async_hooks$/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|d)\.ts$/.test(entry.name)) out.push(full)
  }
  return out
}

function resolveSpec(spec: string, from: string, root: string): string | null {
  let base: string
  if (spec.startsWith("@/")) base = path.join(root, spec.slice(2))
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const ext of EXTS) {
    const candidate = base + ext
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function onlyTypeSpecifiers(clause: string | undefined): boolean {
  if (!clause) return false
  const braces = clause.match(/\{([^}]*)\}/)
  if (!braces) return false
  const outside = clause.replace(/\{[^}]*\}/, "").replace(/\s+from\s+$/, "").trim()
  if (/^[\w$*]/.test(outside)) return false
  const parts = braces[1]!.split(",").map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 && parts.every((p) => /^type\s/.test(p))
}

type Info = { deps: string[]; forbidden: boolean; client: boolean }
const cache = new Map<string, Info>()

function info(file: string, root: string = ROOT): Info {
  const cached = cache.get(file)
  if (cached) return cached
  let src = ""
  try {
    src = fs.readFileSync(file, "utf8")
  } catch {
    /* unreadable: treated as empty */
  }
  const head = src.slice(0, 400)
  const isServerAction = /^\s*["']use server["']/.test(head)
  const deps: string[] = []
  let forbidden = false
  if (!isServerAction) {
    for (const m of src.matchAll(IMPORT_RE)) {
      if (m[2] || onlyTypeSpecifiers(m[3])) continue
      const spec = m[4]!
      if (FORBIDDEN_IN_BROWSER.test(spec)) forbidden = true
      else {
        const resolved = resolveSpec(spec, file, root)
        if (resolved) deps.push(resolved)
      }
    }
    for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
      const resolved = resolveSpec(m[1]!, file, root)
      if (resolved) deps.push(resolved)
    }
  }
  const result: Info = { deps, forbidden, client: /^\s*["']use client["']/.test(head) }
  cache.set(file, result)
  return result
}

function offenders(root: string = ROOT): string[] {
  const found: string[] = []
  for (const entry of walk(root).filter((f) => info(f, root).client)) {
    const parent = new Map<string, string | null>([[entry, null]])
    const queue = [entry]
    while (queue.length) {
      const file = queue.shift()!
      if (info(file, root).forbidden) {
        const chain: string[] = []
        for (let c: string | null | undefined = file; c; c = parent.get(c)) chain.unshift(path.relative(root, c))
        found.push(chain.join(" -> "))
        break
      }
      for (const dep of info(file, root).deps) {
        if (!parent.has(dep)) {
          parent.set(dep, file)
          queue.push(dep)
        }
      }
    }
  }
  return found
}

describe("client bundles never reach node:async_hooks", () => {
  it("no 'use client' module value-imports (directly or not) a module that imports node:async_hooks", () => {
    expect(offenders()).toEqual([])
  })

  it("the scan is not blind: it flags a fixture where a client module reaches a static node:async_hooks import, and ignores erased imports", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "client-scan-"))
    try {
      fs.mkdirSync(path.join(dir, "lib"), { recursive: true })
      fs.mkdirSync(path.join(dir, "components"), { recursive: true })
      fs.writeFileSync(path.join(dir, "lib/meter.ts"), 'import { AsyncLocalStorage } from "node:async_hooks"\nexport const als = new AsyncLocalStorage()\n')
      fs.writeFileSync(path.join(dir, "lib/typesonly.ts"), 'import type { AsyncLocalStorage } from "node:async_hooks"\nexport type A = AsyncLocalStorage<number>\n')
      fs.writeFileSync(path.join(dir, "lib/client.ts"), 'import { als } from "@/lib/meter"\nexport const x = als\n')
      fs.writeFileSync(path.join(dir, "components/bad.tsx"), '"use client"\nimport { x } from "@/lib/client"\nexport const B = () => x\n')
      fs.writeFileSync(path.join(dir, "components/good.tsx"), '"use client"\nimport type { A } from "@/lib/typesonly"\nimport { type A as B } from "@/lib/typesonly"\nexport const G = (a: A, b: B) => [a, b]\n')
      const found = offenders(dir)
      expect(found).toHaveLength(1)
      expect(found[0]).toContain("components/bad.tsx")
      expect(found[0]).toContain("lib/meter.ts")
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("the usage meter no longer imports node:async_hooks as a value (it looks AsyncLocalStorage up at runtime)", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/ai/usage-log.ts"), "utf8")
    expect(src).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+["']node:async_hooks["']/m)
    expect(src).toMatch(/^import type \{[^}]*\} from "node:async_hooks"/m)
  })

  it("the variant table and the add-product form only import the client-safe module", () => {
    for (const f of ["components/supplier/supplier-variant-table.tsx", "components/supplier/supplier-add-product-form.tsx"]) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8")
      expect(src).toContain("@/lib/supplier-optimize-variants-shared")
      expect(src).not.toMatch(/from "@\/lib\/supplier-optimize-variants"/)
    }
  })
})
