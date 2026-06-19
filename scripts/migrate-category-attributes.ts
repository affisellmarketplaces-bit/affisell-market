#!/usr/bin/env npx tsx
/**
 * Data migration — CategoryAttribute → global Attribute catalog + backfills.
 *
 * Usage:
 *   npx tsx scripts/migrate-category-attributes.ts --dry-run
 *   npx tsx scripts/migrate-category-attributes.ts --apply
 *   npx tsx scripts/migrate-category-attributes.ts --rollback
 *
 * Writes:
 *   scripts/migration-report.csv
 *   scripts/.migration-category-attributes-state.json (for rollback)
 */
import { config } from "dotenv"
import { createHash } from "node:crypto"
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient, type AttributeValueType } from "@prisma/client"

import { mapLegacyTypeToEnum, slugifyAttributeKey } from "@/lib/category-attribute-catalog"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const REPORT_PATH = resolve(process.cwd(), "scripts/migration-report.csv")
const STATE_PATH = resolve(process.cwd(), "scripts/.migration-category-attributes-state.json")

type MigrationState = {
  batchId: string
  appliedAt: string
  attributeIds: string[]
  attributeOptionIds: string[]
  linkedCategoryAttributeIds: string[]
  backfilledProductIds: string[]
  pathIdsUpdatedCategoryIds: string[]
}

type ReportRow = {
  phase: string
  entity: string
  entityId: string
  action: string
  detail: string
}

const report: ReportRow[] = []

function logReport(phase: string, entity: string, entityId: string, action: string, detail: string) {
  report.push({ phase, entity, entityId, action, detail })
  console.log(`[migrate-category-attributes]`, { phase, entity, entityId, action, detail })
}

function writeReportCsv() {
  const header = "phase,entity,entityId,action,detail\n"
  const body = report
    .map((r) =>
      [r.phase, r.entity, r.entityId, r.action, r.detail]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n")
  writeFileSync(REPORT_PATH, header + body + "\n", "utf8")
  console.log("[migrate-category-attributes]", { reportPath: REPORT_PATH, rows: report.length })
}

function saveState(state: MigrationState) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8")
}

function loadState(): MigrationState | null {
  if (!existsSync(STATE_PATH)) return null
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as MigrationState
}

function optionSlug(value: string): string {
  const base = slugifyAttributeKey(value)
  return base || createHash("sha1").update(value).digest("hex").slice(0, 12)
}

async function backfillCategoryPathIds(dryRun: boolean): Promise<string[]> {
  const rows = await prisma.category.findMany({
    select: { id: true, parentId: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const pathById = new Map<string, string>()

  function materialize(id: string, guard = new Set<string>()): string {
    if (pathById.has(id)) return pathById.get(id)!
    if (guard.has(id)) return id
    guard.add(id)
    const row = byId.get(id)
    if (!row?.parentId) {
      pathById.set(id, id)
      return id
    }
    const parentPath = materialize(row.parentId, guard)
    const path = `${parentPath}.${id}`
    pathById.set(id, path)
    return path
  }

  const updated: string[] = []
  for (const row of rows) {
    const next = materialize(row.id)
    if (!dryRun) {
      await prisma.category.update({
        where: { id: row.id },
        data: { pathIds: next },
      })
    }
    updated.push(row.id)
    logReport("pathIds", "Category", row.id, dryRun ? "dry-run" : "updated", next)
  }
  return updated
}

async function migrateAttributesFromCategoryAttributes(
  dryRun: boolean,
  batchId: string
): Promise<{
  attributeIds: string[]
  attributeOptionIds: string[]
  linkedCategoryAttributeIds: string[]
}> {
  const rows = await prisma.categoryAttribute.findMany({
    orderBy: [{ categoryId: "asc" }, { order: "asc" }],
  })

  const attributeIds: string[] = []
  const attributeOptionIds: string[] = []
  const linkedCategoryAttributeIds: string[] = []
  const slugToAttributeId = new Map<string, string>()

  for (const row of rows) {
    const slug = slugifyAttributeKey(row.key)
    let attributeId = slugToAttributeId.get(slug)

    if (!attributeId) {
      const existing = await prisma.attribute.findUnique({ where: { slug } })
      if (existing) {
        attributeId = existing.id
      } else if (!dryRun) {
        const created = await prisma.attribute.create({
          data: {
            slug,
            name: row.label.trim() || row.key,
            type: mapLegacyTypeToEnum(row.type, row.unit) as AttributeValueType,
            unit: row.unit,
            validationJson: row.validationRule ?? undefined,
          },
        })
        attributeId = created.id
        attributeIds.push(created.id)
        logReport("attributes", "Attribute", created.id, "created", slug)
      } else {
        attributeId = `dry-${slug}`
        logReport("attributes", "Attribute", attributeId, "dry-run-create", slug)
      }
      slugToAttributeId.set(slug, attributeId)
    }

    if (!dryRun && row.attributeId !== attributeId) {
      await prisma.categoryAttribute.update({
        where: { id: row.id },
        data: {
          attributeId,
          isFilterable: row.isFilterable ?? row.showInFilter,
          isVariant:
            row.isVariant ||
            ["color", "colour", "storage_gb", "ram_gb", "size"].includes(row.key.toLowerCase()),
        },
      })
      linkedCategoryAttributeIds.push(row.id)
      logReport("link", "CategoryAttribute", row.id, "linked", attributeId)
    }

    const options = row.options ?? []
    for (let i = 0; i < options.length; i++) {
      const value = options[i]!.trim()
      if (!value || dryRun || attributeId.startsWith("dry-")) continue

      const optSlug = optionSlug(value)
      const existingOpt = await prisma.attributeOption.findUnique({
        where: { attributeId_slug: { attributeId, slug: optSlug } },
      })
      if (existingOpt) continue

      const opt = await prisma.attributeOption.create({
        data: {
          attributeId,
          value,
          slug: optSlug,
          sortOrder: i + 1,
        },
      })
      attributeOptionIds.push(opt.id)
      logReport("options", "AttributeOption", opt.id, "created", `${slug}:${value}`)
    }
  }

  return { attributeIds, attributeOptionIds, linkedCategoryAttributeIds }
}

async function backfillProductCategoryIds(dryRun: boolean): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, categories: true, name: true },
  })

  const backfilled: string[] = []

  for (const product of products) {
    const labels = (product.categories ?? []).map((c) => c.trim()).filter(Boolean)
    if (labels.length === 0) continue

    let match = null as { id: string; fullPath: string } | null

    for (const label of labels) {
      const byPath = await prisma.category.findFirst({
        where: {
          OR: [
            { fullPath: { equals: label, mode: "insensitive" } },
            { fullPath: { endsWith: label, mode: "insensitive" } },
            { name: { equals: label, mode: "insensitive" } },
          ],
        },
        select: { id: true, fullPath: true },
        orderBy: { level: "desc" },
      })
      if (byPath) {
        match = byPath
        break
      }
    }

    if (!match) {
      logReport("backfill", "Product", product.id, "skipped", `no match for ${labels.join("|")}`)
      continue
    }

    if (!dryRun) {
      await prisma.product.update({
        where: { id: product.id },
        data: { categoryId: match.id },
      })
    }
    backfilled.push(product.id)
    logReport(
      "backfill",
      "Product",
      product.id,
      dryRun ? "dry-run" : "categoryId-set",
      match.fullPath
    )
  }

  return backfilled
}

async function applyMigration(dryRun: boolean) {
  const batchId = createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 16)
  console.log("[migrate-category-attributes]", { mode: dryRun ? "dry-run" : "apply", batchId })

  const pathIdsUpdatedCategoryIds = await backfillCategoryPathIds(dryRun)
  const { attributeIds, attributeOptionIds, linkedCategoryAttributeIds } =
    await migrateAttributesFromCategoryAttributes(dryRun, batchId)
  const backfilledProductIds = await backfillProductCategoryIds(dryRun)

  writeReportCsv()

  if (!dryRun) {
    saveState({
      batchId,
      appliedAt: new Date().toISOString(),
      attributeIds,
      attributeOptionIds,
      linkedCategoryAttributeIds,
      backfilledProductIds,
      pathIdsUpdatedCategoryIds,
    })
  }

  console.log("[migrate-category-attributes]", {
    summary: {
      attributesCreated: attributeIds.length,
      optionsCreated: attributeOptionIds.length,
      categoryAttributesLinked: linkedCategoryAttributeIds.length,
      productsBackfilled: backfilledProductIds.length,
      categoriesPathIds: pathIdsUpdatedCategoryIds.length,
    },
  })
}

async function rollbackMigration() {
  const state = loadState()
  if (!state) {
    console.error("[migrate-category-attributes] No state file — nothing to rollback")
    process.exit(1)
  }

  console.log("[migrate-category-attributes]", { mode: "rollback", batchId: state.batchId })

  if (state.linkedCategoryAttributeIds.length > 0) {
    await prisma.categoryAttribute.updateMany({
      where: { id: { in: state.linkedCategoryAttributeIds } },
      data: { attributeId: null },
    })
  }

  if (state.attributeOptionIds.length > 0) {
    await prisma.attributeOption.deleteMany({
      where: { id: { in: state.attributeOptionIds } },
    })
  }

  if (state.attributeIds.length > 0) {
    await prisma.attribute.deleteMany({
      where: { id: { in: state.attributeIds } },
    })
  }

  if (state.pathIdsUpdatedCategoryIds.length > 0) {
    await prisma.category.updateMany({
      where: { id: { in: state.pathIdsUpdatedCategoryIds } },
      data: { pathIds: null },
    })
  }

  logReport("rollback", "batch", state.batchId, "completed", JSON.stringify(state))
  writeReportCsv()
  console.log("[migrate-category-attributes] Rollback complete (product categoryId backfill NOT reverted)")
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has("--rollback")) {
    await rollbackMigration()
  } else if (args.has("--apply")) {
    await applyMigration(false)
  } else {
    await applyMigration(true)
  }
}

main()
  .catch((error) => {
    console.error("[migrate-category-attributes]", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
