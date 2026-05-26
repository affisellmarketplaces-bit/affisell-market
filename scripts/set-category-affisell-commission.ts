import { config } from "dotenv"

config({ path: ".env.local" })

/**
 * Bulk-set Affisell platform commission by category branch.
 *
 * Examples:
 *   npx tsx scripts/set-category-affisell-commission.ts --percent 12 --path-contains "Électronique"
 *   npx tsx scripts/set-category-affisell-commission.ts --bps 1500 --category-id clxxx --descendants
 *   npx tsx scripts/set-category-affisell-commission.ts --percent 10 --full-path-prefix "Maison" --dry-run
 */
import { PrismaClient } from "@prisma/client"

import {
  affisellCommissionPercentToBps,
  affisellCommissionRateBpsToPercent,
  clampAffisellCommissionRateBps,
} from "../lib/affisell-platform-commission"

const prisma = new PrismaClient()

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i < 0 || i + 1 >= process.argv.length) return undefined
  return process.argv[i + 1]?.trim() || undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function collectDescendantIds(
  rootId: string,
  childrenByParent: Map<string | null, string[]>
): Set<string> {
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    for (const child of childrenByParent.get(id) ?? []) {
      stack.push(child)
    }
  }
  return out
}

async function main() {
  const dryRun = hasFlag("--dry-run")
  const descendants = hasFlag("--descendants")
  const percentRaw = arg("--percent")
  const bpsRaw = arg("--bps")
  const categoryId = arg("--category-id")
  const pathContains = arg("--path-contains")
  const fullPathPrefix = arg("--full-path-prefix")
  const slug = arg("--slug")

  let targetBps: number
  if (bpsRaw != null) {
    targetBps = clampAffisellCommissionRateBps(Number(bpsRaw))
  } else if (percentRaw != null) {
    targetBps = affisellCommissionPercentToBps(Number(percentRaw))
  } else {
    console.error("Provide --percent 12 or --bps 1200")
    process.exit(1)
  }

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, fullPath: true, parentId: true },
  })

  const childrenByParent = new Map<string | null, string[]>()
  for (const c of categories) {
    const p = c.parentId
    if (!childrenByParent.has(p)) childrenByParent.set(p, [])
    childrenByParent.get(p)!.push(c.id)
  }

  let matchIds = new Set<string>()

  if (categoryId) {
    if (!categories.some((c) => c.id === categoryId)) {
      console.error(`Category not found: ${categoryId}`)
      process.exit(1)
    }
    matchIds = descendants
      ? collectDescendantIds(categoryId, childrenByParent)
      : new Set([categoryId])
  } else {
    for (const c of categories) {
      let ok = true
      if (slug && c.slug !== slug) ok = false
      if (pathContains && !c.fullPath.toLowerCase().includes(pathContains.toLowerCase()) &&
          !c.name.toLowerCase().includes(pathContains.toLowerCase())) {
        ok = false
      }
      if (fullPathPrefix && !c.fullPath.toLowerCase().startsWith(fullPathPrefix.toLowerCase())) {
        ok = false
      }
      if (ok) matchIds.add(c.id)
    }
  }

  if (matchIds.size === 0) {
    console.error("No categories matched. Adjust filters.")
    process.exit(1)
  }

  const matched = categories.filter((c) => matchIds.has(c.id))
  console.log(
    `${dryRun ? "[dry-run] " : ""}Setting Affisell commission to ${affisellCommissionRateBpsToPercent(targetBps)}% (${targetBps} bps) on ${matched.length} categories`
  )
  for (const c of matched.slice(0, 30)) {
    console.log(`  · ${c.fullPath || c.name} (${c.id})`)
  }
  if (matched.length > 30) console.log(`  … +${matched.length - 30} more`)

  if (!dryRun) {
    const result = await prisma.category.updateMany({
      where: { id: { in: [...matchIds] } },
      data: { affisellCommissionRateBps: targetBps },
    })
    console.log(`Updated ${result.count} rows.`)
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
