import type { PrismaClient } from "@prisma/client"

import {
  isCategorySuggestionViable,
  leafPathsForDetectedIntent,
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
} from "@/lib/category-title-match"
import type { ListingProductContext } from "@/lib/listing-product-signal"
import { scoreListingContextAgainstBreadcrumb } from "@/lib/listing-product-signal"

export {
  isCategorySuggestionViable,
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
} from "@/lib/category-title-match"

export type BrowseNode = {
  id: string
  name: string
  parentId: string | null
  icon: string
  order: number
}

export type CategoryPathSegment = { id: string; name: string }

export type LeafPath = {
  leafId: string
  breadcrumb: string
  path: CategoryPathSegment[]
}

/** Build adjacency + roots from flat category rows (self-referential Category tree). */
export function buildCategoryBrowse(rows: BrowseNode[]) {
  const nodes: Record<string, BrowseNode> = {}
  for (const r of rows) {
    nodes[r.id] = r
  }

  const childrenByParent = new Map<string | null, string[]>()
  for (const r of rows) {
    const p = r.parentId
    if (!childrenByParent.has(p)) childrenByParent.set(p, [])
    childrenByParent.get(p)!.push(r.id)
  }

  for (const [, ids] of childrenByParent) {
    ids.sort((a, b) => {
      const na = nodes[a]
      const nb = nodes[b]
      const o = (na?.order ?? 0) - (nb?.order ?? 0)
      if (o !== 0) return o
      return (na?.name ?? "").localeCompare(nb?.name ?? "")
    })
  }

  const idSet = new Set(rows.map((r) => r.id))
  let rootIds = childrenByParent.get(null) ?? []
  /** Broken imports: parentId points outside the table — treat those nodes as roots so the UI still works. */
  if (rootIds.length === 0 && rows.length > 0) {
    rootIds = rows
      .filter((r) => r.parentId == null || !idSet.has(r.parentId))
      .map((r) => r.id)
    rootIds.sort((a, b) => {
      const na = nodes[a]
      const nb = nodes[b]
      const o = (na?.order ?? 0) - (nb?.order ?? 0)
      if (o !== 0) return o
      return (na?.name ?? "").localeCompare(nb?.name ?? "")
    })
  }
  /** Fully cyclic tree (every parentId in-set): show all nodes as top-level so the picker is usable. */
  if (rootIds.length === 0 && rows.length > 0) {
    rootIds = rows.map((r) => r.id).sort((a, b) => {
      const na = nodes[a]
      const nb = nodes[b]
      const o = (na?.order ?? 0) - (nb?.order ?? 0)
      if (o !== 0) return o
      return (na?.name ?? "").localeCompare(nb?.name ?? "")
    })
  }

  const leafPaths: LeafPath[] = []

  function dfs(currentId: string, stack: CategoryPathSegment[]) {
    if (stack.some((s) => s.id === currentId)) return
    const node = nodes[currentId]
    if (!node) return
    const seg: CategoryPathSegment = { id: node.id, name: node.name }
    const nextStack = [...stack, seg]
    const kids = childrenByParent.get(currentId) ?? []
    if (kids.length === 0) {
      leafPaths.push({
        leafId: currentId,
        breadcrumb: nextStack.map((s) => s.name).join(" > "),
        path: nextStack,
      })
      return
    }
    for (const kid of kids) {
      dfs(kid, nextStack)
    }
  }

  for (const rid of rootIds) {
    dfs(rid, [])
  }

  /** Every node is a leaf (no children rows) — still expose one path per node for search & selection. */
  if (leafPaths.length === 0 && rows.length > 0) {
    for (const r of rows) {
      leafPaths.push({
        leafId: r.id,
        breadcrumb: r.name,
        path: [{ id: r.id, name: r.name }],
      })
    }
  }

  const childrenRecord: Record<string, string[]> = {}
  for (const [k, v] of childrenByParent) {
    if (k != null) childrenRecord[k] = v
  }

  return { nodes, rootIds, childrenByParent: childrenRecord, leafPaths }
}

export function pathFromLeafId(
  leafId: string,
  nodes: Record<string, BrowseNode>
): CategoryPathSegment[] | null {
  const out: CategoryPathSegment[] = []
  let cur: string | undefined = leafId
  const guard = new Set<string>()
  while (cur) {
    if (guard.has(cur)) return null
    const node: BrowseNode | undefined = nodes[cur]
    if (!node) break
    guard.add(cur)
    out.push({ id: node.id, name: node.name })
    cur = node.parentId ?? undefined
  }
  out.reverse()
  return out.length ? out : null
}

export type CategorySubtreeRow = {
  id: string
  parentId: string | null
  name: string
  fullPath: string
}

export type CategorySubtreeGraph = {
  childrenByParent: Map<string, string[]>
  byId: Map<string, CategorySubtreeRow>
}

function buildChildrenByParent(rows: Array<{ id: string; parentId: string | null }>): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.parentId) continue
    if (!childrenByParent.has(r.parentId)) childrenByParent.set(r.parentId, [])
    childrenByParent.get(r.parentId)!.push(r.id)
  }
  return childrenByParent
}

/** Single `category.findMany` — reuse for all scopes on one request (avoids P2024). */
export async function buildCategorySubtreeGraph(prisma: PrismaClient): Promise<CategorySubtreeGraph> {
  const rows = await prisma.category.findMany({
    select: { id: true, parentId: true, name: true, fullPath: true },
  })
  const byId = new Map<string, CategorySubtreeRow>()
  for (const r of rows) {
    byId.set(r.id, r)
  }
  return { childrenByParent: buildChildrenByParent(rows), byId }
}

export function collectCategorySubtreeIdsFromGraph(graph: CategorySubtreeGraph, rootId: string): string[] {
  const out = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const kid of graph.childrenByParent.get(id) ?? []) {
      if (!out.has(kid)) {
        out.add(kid)
        stack.push(kid)
      }
    }
  }
  return [...out]
}

export function labelsForCategoryScopeRows(rows: Array<{ name: string; fullPath: string }>): Set<string> {
  const labels = new Set<string>()
  for (const row of rows) {
    const name = row.name.trim()
    if (name) labels.add(name.toLowerCase())
    const path = row.fullPath.trim()
    if (!path) continue
    labels.add(path.toLowerCase())
    for (const segment of path.split(">")) {
      const part = segment.trim().toLowerCase()
      if (part) labels.add(part)
    }
  }
  return labels
}

let inflightSubtreeGraph: Promise<CategorySubtreeGraph> | null = null

/** Coalesce parallel `collectCategorySubtreeIds` in the same tick into one DB round-trip. */
async function loadCategorySubtreeGraphCoalesced(prisma: PrismaClient): Promise<CategorySubtreeGraph> {
  if (!inflightSubtreeGraph) {
    inflightSubtreeGraph = buildCategorySubtreeGraph(prisma).finally(() => {
      queueMicrotask(() => {
        inflightSubtreeGraph = null
      })
    })
  }
  return inflightSubtreeGraph
}

/** Test hook — reset coalesced loader between cases. */
export function resetCategorySubtreeGraphInflightForTests(): void {
  inflightSubtreeGraph = null
}

/** All category ids in a subtree (node + descendants) for marketplace filters. */
export async function collectCategorySubtreeIds(
  prisma: PrismaClient,
  rootId: string
): Promise<string[]> {
  const graph = await loadCategorySubtreeGraphCoalesced(prisma)
  return collectCategorySubtreeIdsFromGraph(graph, rootId)
}

export async function fetchAllCategoriesForBrowse(prisma: PrismaClient): Promise<BrowseNode[]> {
  const rows = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true, icon: true, order: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parentId,
    icon: r.icon,
    order: r.order,
  }))
}

export function scoreTitleAgainstBreadcrumb(title: string, breadcrumb: string): number {
  return scoreProductTextAgainstBreadcrumb(title, breadcrumb)
}

const MAX_CATALOG_LINES_FOR_AI = 280

/**
 * Order leaf paths for AI category matching: high title/breadcrumb overlap first, then the rest
 * (so the model always sees plausible leaves even when the tree is large).
 */
export function leafPathsForAiCatalog(
  leafPaths: LeafPath[],
  titleOrContext: string | ListingProductContext,
  description?: string
): LeafPath[] {
  const ctx: ListingProductContext =
    typeof titleOrContext === "string"
      ? {
          title: titleOrContext.trim(),
          supplierDetails: (description ?? "").trim(),
          productName: titleOrContext.trim(),
          coreTokens: [],
          classificationFocus: titleOrContext.trim(),
          nameConfidence: 0.5,
        }
      : titleOrContext

  const text = ctx.classificationFocus || ctx.title
  if (!text.trim()) return leafPaths.slice(0, MAX_CATALOG_LINES_FOR_AI)

  const out: LeafPath[] = []
  const seen = new Set<string>()
  for (const lp of leafPathsForDetectedIntent(ctx.title, ctx.supplierDetails, leafPaths, 20)) {
    if (!seen.has(lp.leafId)) {
      seen.add(lp.leafId)
      out.push(lp)
    }
  }

  const scored = leafPaths
    .map((lp) => ({
      lp,
      s: scoreListingContextAgainstBreadcrumb(ctx, lp.breadcrumb),
    }))
    .filter(({ lp }) =>
      isCategorySuggestionViable(`${ctx.classificationFocus} ${ctx.supplierDetails}`.trim(), lp.breadcrumb, 1)
    )
  scored.sort((a, b) => b.s - a.s)

  for (const { lp, s } of scored) {
    if (out.length >= MAX_CATALOG_LINES_FOR_AI) break
    if (s > 0 && !seen.has(lp.leafId)) {
      seen.add(lp.leafId)
      out.push(lp)
    }
  }
  for (const lp of leafPaths) {
    if (out.length >= MAX_CATALOG_LINES_FOR_AI) break
    if (!seen.has(lp.leafId)) {
      seen.add(lp.leafId)
      out.push(lp)
    }
  }
  return out
}

export function suggestLeafCategoriesFromTitle(title: string, leafPaths: LeafPath[], limit = 3): LeafPath[] {
  return suggestLeafCategoriesFromProductText(title, "", leafPaths, limit)
}

export type RecentCategoryEntry = { leafId: string; path: CategoryPathSegment[] }

export function parseRecentCategoriesJson(raw: unknown): RecentCategoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: RecentCategoryEntry[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const leafId = typeof o.leafId === "string" ? o.leafId.trim() : ""
    const pathRaw = o.path
    if (!leafId || !Array.isArray(pathRaw)) continue
    const path: CategoryPathSegment[] = []
    for (const seg of pathRaw) {
      if (!seg || typeof seg !== "object") continue
      const s = seg as Record<string, unknown>
      const id = typeof s.id === "string" ? s.id.trim() : ""
      const name = typeof s.name === "string" ? s.name.trim() : ""
      if (id && name) path.push({ id, name })
    }
    if (path.length) out.push({ leafId, path })
  }
  return out.slice(0, 8)
}

export function pushRecentCategory(
  prev: RecentCategoryEntry[],
  entry: RecentCategoryEntry,
  max = 5
): RecentCategoryEntry[] {
  const next = [{ leafId: entry.leafId, path: entry.path }, ...prev.filter((e) => e.leafId !== entry.leafId)]
  return next.slice(0, max)
}
