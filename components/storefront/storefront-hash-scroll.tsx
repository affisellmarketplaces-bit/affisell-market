"use client"

import { useEffect } from "react"

/** Deep-link support for newsletter flash sale emails (`#flash-sale`). */
export function StorefrontHashScroll() {
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace(/^#/, "").trim()
      if (!id) return
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" })
      }
    }

    scrollToHash()
    window.addEventListener("hashchange", scrollToHash)
    return () => window.removeEventListener("hashchange", scrollToHash)
  }, [])

  return null
}
