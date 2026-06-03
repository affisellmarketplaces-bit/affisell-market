"use client"

import { LanguageSwitcher } from "@/components/LanguageSwitcher"

/** Demo Lab hides global nav — locale control stays reachable. */
export function DemoLocaleAnchor() {
  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-[210] sm:right-4">
      <div className="pointer-events-auto">
        <LanguageSwitcher />
      </div>
    </div>
  )
}
