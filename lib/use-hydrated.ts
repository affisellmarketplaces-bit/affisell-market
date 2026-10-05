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

const noopSubscribe = () => () => {}

/**
 * The page origin (`https://host`), or `undefined` on the server and during hydration, then the real value.
 *
 * Reading `window.location.origin` while rendering gives the server one value and the browser another
 * (`https://affisell.com` fallback vs `http://localhost:3001`), so React reports a hydration mismatch and discards the
 * server HTML. This hook renders the server's value first and updates right after hydration.
 */
export function useBrowserOrigin(): string | undefined {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => undefined
  )
}
