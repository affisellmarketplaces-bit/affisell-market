"use client"

import { useCallback, useMemo, useState } from "react"

export function useSupplierDraftSelection(allIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const visibleSelectedCount = useMemo(
    () => allIds.filter((id) => selectedIds.has(id)).length,
    [allIds, selectedIds]
  )

  const allSelected = allIds.length > 0 && visibleSelectedCount === allIds.length

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allIds))
  }, [allIds])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const removeFromSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [])

  return {
    selectedIds,
    visibleSelectedCount,
    allSelected,
    toggle,
    selectAll,
    clearSelection,
    removeFromSelection,
  }
}
