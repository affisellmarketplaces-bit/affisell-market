/** Prefetch a list of app routes — safe to call from client effects / link hover. */
export function prefetchRoutes(
  prefetch: (href: string) => void,
  routes: readonly string[]
): void {
  for (const path of routes) {
    if (!path || path.startsWith("/#")) continue
    try {
      prefetch(path)
    } catch {
      /* ignore */
    }
  }
}
