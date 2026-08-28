"use client"

import { useEffect } from "react"

import { initClientGuard } from "@/lib/security/client-guard"

export default function ClientGuardInit() {
  useEffect(() => {
    initClientGuard()
  }, [])

  return null
}
