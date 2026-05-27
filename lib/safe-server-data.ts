/**
 * Wrap server data loaders so a DB blip never trips a route error boundary.
 */
export async function loadOrFallback<T>(
  scope: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[${scope}]`, error)
    return fallback
  }
}
