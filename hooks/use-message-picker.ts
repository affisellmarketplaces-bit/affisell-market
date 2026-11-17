"use client"

import { useMessages } from "next-intl"
import { useCallback } from "react"

/**
 * Client replacement for `tMessage(locale, path)` inside React: reads the messages the root `IntlAppProvider`
 * already holds (the visitor's locale, merged over English — the same fallback `tMessage` applies), instead of
 * `lib/i18n-pick-message.ts`, which imports all eight catalogues (~3.6 MB) into whatever bundle uses it.
 * Returns `fallback ?? path` when the key is missing or not a string, exactly like `tMessage`.
 */
export function useMessagePicker(): (path: string, fallback?: string) => string {
  const messages = useMessages()
  return useCallback(
    (path: string, fallback?: string) => {
      let cur: unknown = messages
      for (const part of path.split(".")) {
        if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
          cur = undefined
          break
        }
        cur = (cur as Record<string, unknown>)[part]
      }
      return typeof cur === "string" && cur.trim() ? cur : (fallback ?? path)
    },
    [messages]
  )
}
