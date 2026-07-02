"use client"

import { startTransition } from "react"

import { signalInstantNavigationStart } from "@/lib/instant-navigation-events.client"

type NavigateFn = (href: string) => void

let navigateFn: NavigateFn | null = null

export function registerClientNavigate(fn: NavigateFn | null): void {
  navigateFn = fn
}

/** Client-side navigation without full reload when the bridge is mounted. */
export function clientNavigate(href: string): boolean {
  if (!navigateFn) return false
  signalInstantNavigationStart()
  startTransition(() => navigateFn!(href))
  return true
}

export function clientNavigateOrAssign(href: string): void {
  if (!clientNavigate(href)) {
    window.location.assign(href)
  }
}
