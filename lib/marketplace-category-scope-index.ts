import {
  collectCategorySubtreeIdsFromGraph,
  labelsForCategoryScopeRows,
  type CategorySubtreeGraph,
} from "@/lib/category-browse-shared"

export type ScopeIndex = {
  idSet: Set<string>
  labels: Set<string>
}

export function buildScopeIndexFromGraph(
  graph: CategorySubtreeGraph,
  scopeRootId: string
): ScopeIndex {
  const scopeIds = collectCategorySubtreeIdsFromGraph(graph, scopeRootId)
  const rows = scopeIds
    .map((id) => graph.byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
  return {
    idSet: new Set(scopeIds),
    labels: labelsForCategoryScopeRows(rows),
  }
}
