"use client"

import { useSession } from "next-auth/react"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  fetchServerCartCount,
  readLocalCartCount,
} from "@/lib/buyer-cart-count-client"
import { scheduleIdleTask } from "@/lib/schedule-idle-task"

const BACKGROUND_SYNC_DEBOUNCE_MS = 400

type Options = {
  /** Wait for idle before first sync — lowers TBT on home/header paint. */
  deferSync?: boolean
}

/** Live cart unit count — guest localStorage or signed-in `/api/cart`. */
export function useBuyerCartCount(options: Options = {}): number {
  const { deferSync = false } = options
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [count, setCount] = useState(0)
  const [syncEnabled, setSyncEnabled] = useState(!deferSync)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!deferSync) return
    return scheduleIdleTask(() => setSyncEnabled(true), 2600, 650)
  }, [deferSync])

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

  const syncDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void sync()
    }, BACKGROUND_SYNC_DEBOUNCE_MS)
  }, [sync])

  useEffect(() => {
    if (!syncEnabled) return

    void sync()

    const onCartChange = () => {
      void sync()
    }

    const onBackground = () => {
      if (document.visibilityState === "hidden") return
      syncDebounced()
    }

    window.addEventListener("affisell:cart-updated", onCartChange)
    window.addEventListener("affisell:cart-added", onCartChange)
    window.addEventListener("focus", onBackground)
    document.addEventListener("visibilitychange", onBackground)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      window.removeEventListener("affisell:cart-updated", onCartChange)
      window.removeEventListener("affisell:cart-added", onCartChange)
      window.removeEventListener("focus", onBackground)
      document.removeEventListener("visibilitychange", onBackground)
    }
  }, [sync, syncDebounced, syncEnabled])

  return count
}
