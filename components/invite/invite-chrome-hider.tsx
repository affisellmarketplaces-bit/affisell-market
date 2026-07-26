"use client"

import { useEffect } from "react"

/** Toggle body class so invite can hide platform chrome without CSS `:has()`. */
export function InviteChromeHider() {
  useEffect(() => {
    document.body.classList.add("affisell-invite-shell")
    return () => {
      document.body.classList.remove("affisell-invite-shell")
    }
  }, [])
  return null
}
