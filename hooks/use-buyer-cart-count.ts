"use client"

import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"

import {
  fetchServerCartCount,
  readLocalCartCount,
} from "@/lib/buyer-cart-count-client"

/** Live cart unit count — guest localStorage or signed-in `/api/cart`. */
export function useBuyerCartCount(): number {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [count, setCount] = useState(0)

  const sync = useCallback(async () => {
    if (!userId) {
      setCount(readLocalCartCount())
      return
    }
    try {
      setCount(await fetchServerCartCount())
    } catch {
      setCount(0)
    }
  }, [userId])

  useEffect(() => {
    void sync()

    const onChange = () => {
      void sync()
    }

    window.addEventListener("affisell:cart-updated", onChange)
    window.addEventListener("affisell:cart-added", onChange)
    window.addEventListener("focus", onChange)
    document.addEventListener("visibilitychange", onChange)

    return () => {
      window.removeEventListener("affisell:cart-updated", onChange)
      window.removeEventListener("affisell:cart-added", onChange)
      window.removeEventListener("focus", onChange)
      document.removeEventListener("visibilitychange", onChange)
    }
  }, [sync])

  return count
}
