import { useCallback, useEffect, useRef, useState } from "react"

type Options = {
  enabled: boolean
  delayMs: number
  forceKiosk?: boolean
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "wheel"] as const

/** User inactivity timer — distinct from browser idle (`useIdleMount`). */
export function useMirrorAttractIdle({ enabled, delayMs, forceKiosk = false }: Options): {
  visible: boolean
  dismiss: () => void
} {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const schedule = useCallback(() => {
    if (!enabled || visibleRef.current) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      if (document.hidden) return
      visibleRef.current = true
      setVisible(true)
      console.log("[mirror-attract]", { event: "shown", delayMs, forceKiosk })
    }, delayMs)
  }, [clearTimer, delayMs, enabled, forceKiosk])

  const dismiss = useCallback(() => {
    if (!visibleRef.current) return
    visibleRef.current = false
    setVisible(false)
    console.log("[mirror-attract]", { event: "dismissed" })
    schedule()
  }, [schedule])

  const onActivity = useCallback(() => {
    if (visibleRef.current) return
    schedule()
  }, [schedule])

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  useEffect(() => {
    if (!enabled) {
      clearTimer()
      visibleRef.current = false
      setVisible(false)
      return
    }

    schedule()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    const onVisibility = () => {
      if (document.hidden) {
        clearTimer()
        if (visibleRef.current) {
          visibleRef.current = false
          setVisible(false)
        }
      } else {
        schedule()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearTimer()
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [clearTimer, enabled, onActivity, schedule])

  return { visible, dismiss }
}
