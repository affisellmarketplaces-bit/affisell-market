"use client"

import { useEffect } from "react"

export function RefCookieSetter({ refId }: { refId: string | undefined }) {
  useEffect(() => {
    if (!refId) return
    document.cookie = `aff_ref=${encodeURIComponent(refId)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
  }, [refId])

  return null
}
