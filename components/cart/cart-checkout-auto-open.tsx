"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

type Props = {
  enabled: boolean
  onOpen: () => void
}

/** Opens checkout identity sheet when guest lands on `/cart?checkout=1`. */
export function CartCheckoutAutoOpen({ enabled, onOpen }: Props) {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!enabled) return
    if (searchParams.get("checkout") === "1") onOpen()
  }, [enabled, searchParams, onOpen])

  return null
}
