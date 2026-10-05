import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * `false` on the server and during the first client render, `true` once React has hydrated.
 *
 * Gate a form's submit button with it. Before hydration `onSubmit` is not attached yet, so a click (or Enter) makes the
 * browser submit the form natively: a GET that writes every named field — the password included — into the address
 * bar, history and server logs, and then reloads the page with the fields emptied. On a slow connection or a cold dev
 * server that window is long enough for people to hit it.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
