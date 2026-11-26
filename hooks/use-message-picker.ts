"use client"

import { useMessages } from "next-intl"
import { useCallback } from "react"

/**
 * `tMessage(locale, path)` for React components: reads the messages the root `IntlAppProvider` already holds (the
 * visitor's locale, merged over English — the same fallback `tMessage` applies). `tMessage` is also bundle-safe in
 * the browser (`#i18n-catalog`); inside a component prefer this hook, which reads the provider's messages directly.
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
