import { describe, expect, it } from "vitest"

import {
  collectCategorySubtreeIdsFromGraph,
  labelsForCategoryScopeRows,
  type CategorySubtreeGraph,
} from "@/lib/category-browse"

function graphFromRows(
  rows: Array<{ id: string; parentId: string | null; name: string; fullPath: string }>
): CategorySubtreeGraph {
  const childrenByParent = new Map<string, string[]>()
  const byId = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    byId.set(r.id, r)
    if (r.parentId) {
      if (!childrenByParent.has(r.parentId)) childrenByParent.set(r.parentId, [])
      childrenByParent.get(r.parentId)!.push(r.id)
    }
  }
  return { childrenByParent, byId }
}

describe("category subtree graph", () => {
  it("collects root and descendants", () => {
    const graph = graphFromRows([
      { id: "root", parentId: null, name: "Root", fullPath: "Root" },
      { id: "a", parentId: "root", name: "A", fullPath: "Root > A" },
      { id: "b", parentId: "a", name: "B", fullPath: "Root > A > B" },
      { id: "other", parentId: null, name: "Other", fullPath: "Other" },
    ])
    expect(collectCategorySubtreeIdsFromGraph(graph, "root").sort()).toEqual(["a", "b", "root"])
  })

  it("labelsForCategoryScopeRows includes path segments", () => {
    const labels = labelsForCategoryScopeRows([
      { name: "Leaf", fullPath: "Root Dept > Leaf Aisle" },
    ])
    expect(labels.has("leaf")).toBe(true)
    expect(labels.has("root dept > leaf aisle")).toBe(true)
    expect(labels.has("root dept")).toBe(true)
    expect(labels.has("leaf aisle")).toBe(true)
  })
})
