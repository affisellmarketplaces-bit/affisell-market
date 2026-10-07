"use client"

import { useEffect, useState } from "react"

import type { DuplicateMatch } from "@/lib/listing-compliance/duplicates.server"

export type DuplicateCheckInput = {
  gtin: string
  name: string
  imageUrl: string
  excludeId?: string | null
}

/**
 * Advisory "you already have a similar product", debounced. A failure or an empty answer just means "no hint": it must
 * never get in the way of filling the form. (Type-only import of the server module: nothing from it ships to the browser.)
 */
export function useDuplicateCheck({ gtin, name, imageUrl, excludeId }: DuplicateCheckInput): DuplicateMatch[] {
  const [matches, setMatches] = useState<DuplicateMatch[]>([])

  useEffect(() => {
    const digits = gtin.replace(/[\s\-.]/g, "")
    const useGtin = digits.length >= 8
    const useName = name.trim().length >= 3
    const useImage = imageUrl.startsWith("http")
    if (!useGtin && !useName && !useImage) return

    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      const qs = new URLSearchParams()
      if (useGtin) qs.set("gtin", digits)
      if (useName) qs.set("name", name.trim())
      if (useImage) qs.set("image", imageUrl)
      if (excludeId) qs.set("excludeId", excludeId)
      fetch(`/api/supplier/products/duplicate-check?${qs.toString()}`, { credentials: "include", signal: ac.signal })
        .then((r) => (r.ok ? r.json() : { duplicates: [] }))
        .then((j: { duplicates?: DuplicateMatch[] }) => setMatches(Array.isArray(j.duplicates) ? j.duplicates : []))
        .catch(() => undefined)
    }, 700)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [gtin, name, imageUrl, excludeId])

  return matches
}
