"use client"

import type { ReactNode } from "react"

import { affisellBoutiqueChromeStyle } from "@/lib/boutique/boutique-affisell-chrome-shared"

type Props = {
  children: ReactNode
}

/** Platform chrome scope — isolates Affisell nav colors from reseller boutique skins. */
export function BoutiqueAffisellChromeVars({ children }: Props) {
  return (
    <div className="boutique-affisell-chrome" style={affisellBoutiqueChromeStyle()}>
      {children}
    </div>
  )
}
