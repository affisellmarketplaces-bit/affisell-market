"use client"

import type { ReactNode } from "react"

import { DonaAvatarImage } from "@/components/dona/dona-avatar-image"
import { cn } from "@/lib/utils"

type Props = {
  onClick: () => void
  ariaLabel: string
  alt: string
  /** Stacking level — differs between the public and captain widgets. */
  zClassName?: string
  /** Small pill pinned to the top-right of the sphere (e.g. "CAPTAIN"). */
  badge?: ReactNode
}

/**
 * Dona launcher — a full sphere with the whole face framed (head-scarf to chin), a light gradient rim,
 * glass highlight and a breathing halo. Positioning stays on `.affisell-dona-fab` (dock / buy-bar aware).
 */
export function DonaFabOrb({ onClick, ariaLabel, alt, zClassName = "z-[99]", badge }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn("affisell-dona-fab dona-orb fixed", zClassName)}
    >
      <span className="dona-orb__halo" aria-hidden />
      <span className="dona-orb__ring">
        <span className="dona-orb__sphere">
          <DonaAvatarImage className="dona-orb__img" alt={alt} loading="eager" variant="portrait" />
          <span className="dona-orb__gloss" aria-hidden />
        </span>
      </span>
      {badge ? (
        <span className="absolute -right-1 -top-1 z-10 rounded-full bg-zinc-950 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-white/30">
          {badge}
        </span>
      ) : null}
      <span className="dona-orb__status" aria-hidden />
    </button>
  )
}
