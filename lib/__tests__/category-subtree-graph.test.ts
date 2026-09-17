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

  it("labelsForCategoryScopeRows matches the row's own name and full path only", () => {
    const labels = labelsForCategoryScopeRows([
      { name: "Leaf", fullPath: "Root Dept > Leaf Aisle" },
    ])
    expect(labels.has("leaf")).toBe(true)
    expect(labels.has("root dept > leaf aisle")).toBe(true)
  })

  it("labelsForCategoryScopeRows does not leak ancestor segments into a child scope", () => {
    // A product tagged only at the ancestor ("Root Dept") must not match a
    // narrower descendant scope ("Leaf Aisle") — that inflated counts and
    // caused the live catalog filter to return nothing for a category the
    // sidebar claimed had listings.
    const labels = labelsForCategoryScopeRows([
      { name: "Leaf Aisle", fullPath: "Root Dept > Leaf Aisle" },
    ])
    expect(labels.has("root dept")).toBe(false)
  })
})
