type InstantScanLogPayload = Record<string, unknown>

export function logInstantScan(message: string, payload?: InstantScanLogPayload): void {
  if (payload) {
    console.log(`[InstantScan] ${message}`, payload)
    return
  }
  console.log(`[InstantScan] ${message}`)
}
