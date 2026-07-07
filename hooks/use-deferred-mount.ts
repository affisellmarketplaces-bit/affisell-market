import { useEffect, useState } from "react"

/**
 * Mount heavy UI one frame after `active` — sheet shell paints first, content on next frame (INP).
 */
export function useDeferredMount(active: boolean): boolean {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!active) {
      setMounted(false)
      return
    }
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [active])

  return active && mounted
}
