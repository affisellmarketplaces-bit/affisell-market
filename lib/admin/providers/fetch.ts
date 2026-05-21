import type { ProviderListRow } from "@/lib/admin/providers/serialize"

export async function fetchProviders(): Promise<ProviderListRow[]> {
  const res = await fetch("/api/admin/providers", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load providers")
  const data = (await res.json()) as { providers?: ProviderListRow[]; rows?: ProviderListRow[] }
  return data.providers ?? data.rows ?? []
}
