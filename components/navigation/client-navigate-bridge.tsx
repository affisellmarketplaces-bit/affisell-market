"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { registerClientNavigate } from "@/lib/client-navigate.client"

/** Registers `clientNavigate` for libs outside React (cart fallback, etc.). */
export function ClientNavigateBridge() {
  const router = useRouter()

  useEffect(() => {
    registerClientNavigate((href) => {
      router.push(href)
    })
    return () => registerClientNavigate(null)
  }, [router])

  return null
}
