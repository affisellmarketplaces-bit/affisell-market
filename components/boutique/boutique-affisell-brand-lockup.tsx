"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"

/** Geometric « A » — cyan apex → royal base (matches reseller boutique mockup). */
export function AffisellBoutiqueMark({ className }: { className?: string }) {
  const gradId = useId().replace(/:/g, "")

  return (
    <svg
      viewBox="0 0 36 36"
      className={cn("size-9 shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="18" y1="3" x2="18" y2="33" gradientUnits="userSpaceOnUse">
          <stop
            offset="0%"
            stopColor="var(--boutique-merchant-header-logo-top, #4ee2ec)"
          />
          <stop
            offset="100%"
            stopColor="var(--boutique-merchant-header-logo-bottom, #4a5ae8)"
          />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        fillRule="evenodd"
        d="M18.04 3.75c.28 0 .54.14.7.38l13.18 27.42c.34.58-.1 1.32-.78 1.32h-3.78c-.48 0-.92-.28-1.12-.72l-2.38-5.18H10.36l-2.62 5.62c-.28.58-.88.78-1.44.52a1.02 1.02 0 0 1-.54-.98V31.1c0-.32.08-.62.26-.86L17.34 4.2c.2-.28.48-.45.7-.45Zm-3.82 18.34h7.56L18.04 13.42l-3.82 8.67Z"
      />
    </svg>
  )
}

function ResellerBadgeGem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={cn("size-3.5 shrink-0", className)} aria-hidden>
      <path
        d="M7 1.15 11.85 3.85v6.3L7 12.85 2.15 10.15V3.85L7 1.15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.12"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="2.05" fill="none" stroke="currentColor" strokeWidth="1.05" />
    </svg>
  )
}

type LockupProps = {
  badgeLabel: string
  className?: string
}

/** Affisell wordmark + REVENDEUR pill — canonical lockup for /boutique merchant chrome. */
export function BoutiqueAffisellBrandLockup({ badgeLabel, className }: LockupProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-4", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <AffisellBoutiqueMark />
        <span className="truncate text-[1.2rem] font-bold tracking-[-0.02em] text-white">
          Affisell
        </span>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-[border-color,color] duration-700 ease-in-out"
        style={{
          borderColor: "var(--boutique-merchant-header-badge-border, rgba(78, 226, 236, 0.85))",
          color: "var(--boutique-merchant-header-badge-icon, #4ee2ec)",
        }}
      >
        <ResellerBadgeGem />
        {badgeLabel}
      </span>
    </div>
  )
}
