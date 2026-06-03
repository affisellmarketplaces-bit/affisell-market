import { createHash } from "crypto"

import type { SentinelSignalInput } from "@/lib/sentinel/types"

/** Stable id for idempotent upsert (same issue = same row). */
export function sentinelSignalId(input: Pick<SentinelSignalInput, "code" | "entityId">): string {
  const raw = `${input.code}:${input.entityId ?? ""}`
  return createHash("sha256").update(raw).digest("hex").slice(0, 32)
}

export function withSignalIds(signals: SentinelSignalInput[]): Array<SentinelSignalInput & { id: string }> {
  return signals.map((s) => ({ ...s, id: sentinelSignalId(s) }))
}
