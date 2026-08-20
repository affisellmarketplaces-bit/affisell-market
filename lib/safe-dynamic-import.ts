export const SAFE_DYNAMIC_NULL = Symbol("safe-dynamic-null")

function nullComponent() {
  return null
}

Object.defineProperty(nullComponent, SAFE_DYNAMIC_NULL, { value: true })

/** Dev HMR chunk timeouts must not crash the whole app shell. */
export async function safeDynamicImport<T>(
  loader: () => Promise<T>,
  label: string
): Promise<T | { default: typeof nullComponent }> {
  try {
    return await loader()
  } catch (error) {
    console.warn(`[safe-dynamic-import] ${label} unavailable`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return { default: nullComponent } as T | { default: typeof nullComponent }
  }
}

export function isSafeDynamicNullComponent(component: unknown): boolean {
  return (
    typeof component === "function" &&
    (component as Record<symbol, unknown>)[SAFE_DYNAMIC_NULL] === true
  )
}
