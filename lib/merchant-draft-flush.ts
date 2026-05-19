/** Registry for silent draft saves when merchants leave the dashboard or hide the tab. */

type FlushFn = () => void | Promise<void>

const registry = new Map<string, FlushFn>()

export const MERCHANT_DRAFT_FLUSH_EVENT = "affisell:flush-merchant-drafts"

export function registerMerchantDraftFlush(key: string, fn: FlushFn): () => void {
  registry.set(key, fn)
  return () => {
    registry.delete(key)
  }
}

export async function flushAllMerchantDrafts(): Promise<void> {
  const tasks = [...registry.values()].map((fn) => Promise.resolve(fn()))
  await Promise.allSettled(tasks)
}

export function dispatchMerchantDraftFlush(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(MERCHANT_DRAFT_FLUSH_EVENT))
  void flushAllMerchantDrafts()
}
