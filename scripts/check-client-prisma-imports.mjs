#!/usr/bin/env node
/**
 * Fail CI if a "use client" module value-imports a lib file that loads Prisma.
 * Prevents "PrismaClient cannot be used in the browser" regressions.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".") || ent.name === "node_modules") continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, acc)
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) acc.push(full)
  }
  return acc
}

function resolveLibModule(libImport) {
  const base = path.join(ROOT, "lib", libImport.replace(/^@\//, ""))
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function loadsPrisma(filePath) {
  const src = fs.readFileSync(filePath, "utf8")
  return src.includes('from "@/lib/prisma"') || src.includes("from '@/lib/prisma'")
}

function isClientFile(filePath, src) {
  return /^["']use client["']/.test(src.trimStart())
}

function parseLibImports(src) {
  const out = []
  const re = /^import\s+(?!type)(?:[\s\S]*?)\s+from\s+["']@\/lib\/([^"']+)["']/gm
  let m
  while ((m = re.exec(src))) {
    out.push(m[1])
  }
  return out
}

const prismaLibs = new Set()
for (const file of walk(path.join(ROOT, "lib"))) {
  if (loadsPrisma(file)) prismaLibs.add(file)
}

const violations = []

for (const file of walk(ROOT)) {
  if (!file.includes(`${path.sep}components${path.sep}`) && !file.includes(`${path.sep}app${path.sep}`)) {
    continue
  }
  const src = fs.readFileSync(file, "utf8")
  if (!isClientFile(file, src)) continue

  for (const libImport of parseLibImports(src)) {
    const resolved = resolveLibModule(`@/lib/${libImport}`)
    if (!resolved) continue
    if (loadsPrisma(resolved)) {
      violations.push({ client: path.relative(ROOT, file), lib: `@/lib/${libImport}` })
    }
  }
}

if (violations.length > 0) {
  console.error("Client components must not value-import Prisma-backed lib modules:\n")
  for (const v of violations) {
    console.error(`  ${v.client} → ${v.lib}`)
  }
  console.error("\nFix: move types/constants to a *-types.ts or *-shared.ts file without Prisma.")
  process.exit(1)
}

console.log("check-client-prisma-imports: OK")
