"use client"

import { useEffect } from "react"

import { recordBrowseSignalCategories } from "@/lib/buyer-browse-signals.client"

type Props = {
  categories: readonly string[]
}

/** PDP / listing view — feeds category signals into « Recommandé pour vous ». */
export function ListingBrowseSignalsRecorder({ categories }: Props) {
  useEffect(() => {
    const names = categories.map((name) => name.trim()).filter(Boolean)
    if (names.length === 0) return
    recordBrowseSignalCategories(names)
  }, [categories])

  return null
}
