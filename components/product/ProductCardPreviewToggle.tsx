"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

import { isAffiliateRole, PREVIEW_AS_CUSTOMER_STORAGE_KEY } from "@/lib/product-card-view"
import { cn } from "@/lib/utils"

export function ProductCardPreviewToggle({ className }: { className?: string }) {
  const { data: session } = useSession()
  const isAffiliate = isAffiliateRole(session?.user?.role)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      setOn(window.sessionStorage.getItem(PREVIEW_AS_CUSTOMER_STORAGE_KEY) === "1")
    } catch {
      setOn(false)
    }
  }, [])

  if (!isAffiliate) return null

  function toggle() {
    const next = !on
    setOn(next)
    try {
      if (next) window.sessionStorage.setItem(PREVIEW_AS_CUSTOMER_STORAGE_KEY, "1")
      else window.sessionStorage.removeItem(PREVIEW_AS_CUSTOMER_STORAGE_KEY)
      window.dispatchEvent(new Event("affisell:preview-as-customer"))
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-2 text-xs dark:border-violet-900/50 dark:bg-violet-950/30",
        className
      )}
    >
      <label className="flex cursor-pointer items-center gap-2 font-medium text-violet-900 dark:text-violet-100">
        <input
          type="checkbox"
          checked={on}
          onChange={toggle}
          className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
        />
        Preview as customer
      </label>
    </div>
  )
}
