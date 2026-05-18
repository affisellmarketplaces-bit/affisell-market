"use client"

import type { ReactNode } from "react"

type Props = {
  children: ReactNode[]
}

export function SupplierUrgentCarousel({ children }: Props) {
  return (
    <>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-none sm:hidden"
        role="list"
        aria-label="Actions urgentes"
      >
        {children.map((child, i) => (
          <div key={i} className="min-w-[min(88vw,20rem)] shrink-0 snap-center" role="listitem">
            {child}
          </div>
        ))}
      </div>
      <div className="hidden gap-3 sm:grid sm:grid-cols-3">{children}</div>
    </>
  )
}
