"use client"

import { useEffect } from "react"

import { recordBrowseSignalCategory } from "@/lib/buyer-browse-signals.client"

type Props = {
  categoryName: string | null
}

/** Writes department browse to cookie for cross-session recommendations. */
export function BuyerBrowseSignalsRecorder({ categoryName }: Props) {
  useEffect(() => {
    if (!categoryName?.trim()) return
    recordBrowseSignalCategory(categoryName)
  }, [categoryName])

  return null
}
