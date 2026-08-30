"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, type ComponentProps } from "react"

const NavHeaderSearch = dynamic(
  () =>
    import("@/components/nav/nav-header-search").then((m) => ({
      default: m.NavHeaderSearch,
    })),
  { ssr: false }
)

type Props = ComponentProps<typeof NavHeaderSearch>

/** Desktop header search — skips debounce + fetch bundle on mobile. */
export function NavHeaderSearchDeferred(props: Props) {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => {
      setDesktop(mq.matches)
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!desktop) return null
  return <NavHeaderSearch {...props} />
}
