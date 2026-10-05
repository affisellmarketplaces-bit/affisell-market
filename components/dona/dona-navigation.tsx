"use client"

import { createContext, useContext, type MouseEvent, type ReactNode } from "react"

/**
 * Dona's chat sits above the page (full-screen on phones). A link tapped inside it navigates the page underneath, so
 * unless the chat steps aside the visitor sees nothing happen and concludes the link is dead. The widget provides a
 * minimise callback here; every link in the chat calls it.
 */
type DonaNavigation = { onNavigate: () => void }

const Ctx = createContext<DonaNavigation>({ onNavigate: () => undefined })

export function DonaNavigationProvider({ onNavigate, children }: DonaNavigation & { children: ReactNode }) {
  return <Ctx.Provider value={{ onNavigate }}>{children}</Ctx.Provider>
}

/** A click that stays in this tab (no new tab / window, not already handled) — the only kind that should minimise. */
export function shouldMinimizeOnLinkClick(
  e: Pick<MouseEvent, "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">
): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/** `onClick` for any link rendered inside the chat. */
export function useDonaLinkClick(): (e: MouseEvent) => void {
  const { onNavigate } = useContext(Ctx)
  return (e) => {
    if (shouldMinimizeOnLinkClick(e)) onNavigate()
  }
}
