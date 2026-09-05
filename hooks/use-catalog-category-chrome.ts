"use client"

import { useCallback, useEffect, useState } from "react"

import {
  DEFAULT_CATALOG_CATEGORY_CHROME,
  collapseAllTiers,
  expandAllTiers,
  readCatalogCategoryChrome,
  toggleCollapsedTier,
  writeCatalogCategoryChrome,
  type CatalogCategoryChrome,
} from "@/lib/catalog-category-chrome"

export function useCatalogCategoryChrome() {
  const [chrome, setChrome] = useState<CatalogCategoryChrome>(() => ({
    ...DEFAULT_CATALOG_CATEGORY_CHROME,
    collapsedTiers: [...DEFAULT_CATALOG_CATEGORY_CHROME.collapsedTiers],
  }))

  useEffect(() => {
    setChrome(readCatalogCategoryChrome())
  }, [])

  const patch = useCallback((updater: (prev: CatalogCategoryChrome) => CatalogCategoryChrome) => {
    setChrome((prev) => {
      const next = updater(prev)
      writeCatalogCategoryChrome(next)
      return next
    })
  }, [])

  const toggleTier = useCallback(
    (index: number) => {
      patch((prev) => ({ ...prev, collapsedTiers: toggleCollapsedTier(prev.collapsedTiers, index) }))
    },
    [patch]
  )

  const foldAllAisles = useCallback(() => {
    patch((prev) => ({ ...prev, collapsedTiers: collapseAllTiers() }))
  }, [patch])

  const unfoldAllAisles = useCallback(() => {
    patch((prev) => ({ ...prev, collapsedTiers: expandAllTiers() }))
  }, [patch])

  const revealTier = useCallback(
    (index: number) => {
      if (index < 0 || index > 2) return
      patch((prev) => {
        if (!prev.collapsedTiers[index]) return prev
        const collapsedTiers: [boolean, boolean, boolean] = [...prev.collapsedTiers]
        collapsedTiers[index] = false
        return { ...prev, collapsedTiers }
      })
    },
    [patch]
  )

  const dockForProducts = useCallback(() => {
    patch(() => ({ docked: true, collapsedTiers: collapseAllTiers() }))
    console.log("[catalog-chrome]", { result: "product-focus", docked: true })
  }, [patch])

  const undock = useCallback(() => {
    patch(() => ({ docked: false, collapsedTiers: expandAllTiers() }))
    console.log("[catalog-chrome]", { result: "aisles-open", docked: false })
  }, [patch])

  return {
    chrome,
    toggleTier,
    foldAllAisles,
    unfoldAllAisles,
    revealTier,
    dockForProducts,
    undock,
  }
}
