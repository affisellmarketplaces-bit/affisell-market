"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"

type SmartFilterItem = {
  id: "trending" | "ships24h" | "under100" | "topRated"
  label: string
  href: string
  active: boolean
  icon?: string
}

export function SmartFilters({ items }: { items: SmartFilterItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95",
            item.active
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          {item.icon ? <span className="text-base leading-none opacity-70">{item.icon}</span> : null}
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  )
}
