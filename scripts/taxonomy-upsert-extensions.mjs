/**
 * Idempotent upsert of Affisell-only category extensions (never wipes Google taxonomy).
 *
 * Usage:
 *   node scripts/taxonomy-upsert-extensions.mjs
 *   node scripts/taxonomy-upsert-extensions.mjs --dry-run
 */
import fs from "node:fs"
import path from "node:path"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

function slugify(name, suffix) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + `-${suffix}`
  )
}

function parseExtensions(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8")
  const rows = []
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const parts = trimmed.split(" > ").map((p) => p.trim())
    if (parts.length < 2) {
      console.warn("[taxonomy-upsert-extensions] skip invalid line:", trimmed)
      continue
    }
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join(" > ")
    const fullPath = trimmed
    rows.push({ name, parentPath, fullPath, level: parts.length })
  }
  return rows
}

async function main() {
  const filePath = path.join(process.cwd(), "prisma", "taxonomy-affisell-extensions.txt")
  const rows = parseExtensions(filePath)

  if (rows.length === 0) {
    console.log("[taxonomy-upsert-extensions]", { result: "no_extensions", dryRun })
    return
  }

  let created = 0
  let skipped = 0

  for (const row of rows) {
    const existing = await prisma.category.findFirst({
      where: { fullPath: row.fullPath },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }

    const parent = await prisma.category.findFirst({
      where: { fullPath: row.parentPath },
      select: { id: true },
    })
    if (!parent) {
      console.error("[taxonomy-upsert-extensions] parent missing", { parentPath: row.parentPath })
      process.exitCode = 1
      continue
    }

    const slugBase = slugify(row.name, "ext")
    let slug = slugBase
    let n = 0
    while (await prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
      n += 1
      slug = `${slugBase}-${n}`
    }

    if (dryRun) {
      console.log("[taxonomy-upsert-extensions] would create", { fullPath: row.fullPath, slug })
      created++
      continue
    }

    await prisma.category.create({
      data: {
        googleId: null,
        name: row.name,
        slug,
        parentId: parent.id,
        level: row.level,
        fullPath: row.fullPath,
        isLeaf: true,
        order: 900_000 + created,
      },
    })

    await prisma.category.update({
      where: { id: parent.id },
      data: { isLeaf: false },
    })

    created++
    console.log("[taxonomy-upsert-extensions]", { fullPath: row.fullPath, result: "created" })
  }

  console.log("[taxonomy-upsert-extensions]", { created, skipped, dryRun })
}

main()
  .catch((e) => {
    console.error("[taxonomy-upsert-extensions]", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
