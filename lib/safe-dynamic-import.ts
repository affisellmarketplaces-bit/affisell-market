/** Dev HMR chunk timeouts must not crash the whole app shell. */
export async function safeDynamicImport<T>(
  loader: () => Promise<T>,
  label: string
): Promise<T | { default: () => null }> {
  try {
    return await loader()
  } catch (error) {
    console.warn(`[safe-dynamic-import] ${label} unavailable`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return { default: () => null } as T | { default: () => null }
  }
}
