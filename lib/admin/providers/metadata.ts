export type ProviderHealthMeta = {
  healthStatus?: "OK" | "ERROR"
  healthMessage?: string
  lastHealthCheckAt?: string
}

export function readProviderMetadata(raw: unknown): ProviderHealthMeta & Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as ProviderHealthMeta & Record<string, unknown>
}

export function mergeHealthMetadata(
  existing: unknown,
  patch: ProviderHealthMeta
): Record<string, unknown> {
  const base = readProviderMetadata(existing)
  return { ...base, ...patch }
}
