import type { PrismaClient } from "@prisma/client"

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

/** All category ids in a subtree (node + descendants) for marketplace filters. */
export async function collectCategorySubtreeIds(
  prisma: PrismaClient,
  rootId: string
): Promise<string[]> {
  const rows = await prisma.category.findMany({
    select: { id: true, parentId: true },
  })
  const childrenByParent = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.parentId) continue
    if (!childrenByParent.has(r.parentId)) childrenByParent.set(r.parentId, [])
    childrenByParent.get(r.parentId)!.push(r.id)
  }
  const out = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const kid of childrenByParent.get(id) ?? []) {
      if (!out.has(kid)) {
        out.add(kid)
        stack.push(kid)
      }
    }
  }
  return [...out]
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

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "pack",
  "set",
  "new",
])

export function scoreTitleAgainstBreadcrumb(title: string, breadcrumb: string): number {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w))
  if (words.length === 0) return 0
  const b = breadcrumb.toLowerCase()
  let score = 0
  for (const w of words) {
    /** Longer tokens (e.g. “laptop”) beat short homonyms (e.g. “air” in “MacBook Air”). */
    const lengthBonus = Math.min(w.length, 10) * 0.35
    if (b.includes(w)) score += 3 + lengthBonus
    const stem = w.slice(0, 4)
    if (stem.length >= 3 && b.includes(stem)) score += 1
  }
  return score
}

const MAX_CATALOG_LINES_FOR_AI = 280

/**
 * Order leaf paths for AI category matching: high title/breadcrumb overlap first, then the rest
 * (so the model always sees plausible leaves even when the tree is large).
 */
export function leafPathsForAiCatalog(
  leafPaths: LeafPath[],
  title: string,
  description: string
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  if (!text) return leafPaths.slice(0, MAX_CATALOG_LINES_FOR_AI)

  const scored = leafPaths.map((lp) => ({
    lp,
    s: scoreTitleAgainstBreadcrumb(text, lp.breadcrumb),
  }))
  scored.sort((a, b) => b.s - a.s)

  const out: LeafPath[] = []
  const seen = new Set<string>()
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
  const t = title.trim()
  if (!t) return []

  const scored = leafPaths
    .map((lp) => ({
      lp,
      s: scoreTitleAgainstBreadcrumb(t, lp.breadcrumb),
    }))
    .sort((a, b) => b.s - a.s)

  const picked: LeafPath[] = []
  const seen = new Set<string>()
  for (const { lp, s } of scored) {
    if (picked.length >= limit) break
    if (seen.has(lp.leafId)) continue
    if (s > 0) {
      seen.add(lp.leafId)
      picked.push(lp)
    }
  }

  if (picked.length < limit) {
    for (const lp of leafPaths) {
      if (picked.length >= limit) break
      if (!seen.has(lp.leafId)) {
        seen.add(lp.leafId)
        picked.push(lp)
      }
    }
  }

  return picked.slice(0, limit)
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
