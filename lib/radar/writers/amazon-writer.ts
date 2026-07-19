import "server-only"

import {
  upsertProductSnapshot,
  type ProductSnapshotWriteInput,
  type ProductSnapshotWriteResult,
} from "@/lib/radar/writers/product-writer"

export async function upsertAmazonProductSnapshot(
  input: Omit<ProductSnapshotWriteInput, "marketplaceId"> & { marketplaceId?: string }
): Promise<ProductSnapshotWriteResult> {
  return upsertProductSnapshot({
    ...input,
    marketplaceId: input.marketplaceId ?? "amazon",
  })
}
