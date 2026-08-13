import { createHash } from "node:crypto"

import type { WholesaleSnapshot } from "@/lib/affiliate-wholesale-change-guard"

export function wholesaleSnapshotHash(snapshot: WholesaleSnapshot): string {
  const rows = Object.entries(snapshot.variantWholesaleCents)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, c]) => `${k}:${c}`)
    .join("|")
  const raw = `${snapshot.basePriceCents}#${rows}`
  return createHash("sha256").update(raw).digest("hex").slice(0, 20)
}
