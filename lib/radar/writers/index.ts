export {
  upsertProductSnapshot,
  upsertGlobalSnapshot,
  utcDay,
} from "@/lib/radar/writers/product-writer"
export type {
  ProductSnapshotWriteInput,
  ProductSnapshotWriteResult,
  GlobalSnapshotWriteInput,
  GlobalSnapshotWriteResult,
} from "@/lib/radar/writers/product-writer"

export { upsertTikTokProductSnapshot } from "@/lib/radar/writers/tiktok-writer"
export { upsertAmazonProductSnapshot } from "@/lib/radar/writers/amazon-writer"
export { upsertStandardProduct, upsertStandardProductFromSnapshot } from "@/lib/radar/writers/standard-product-writer"
export type { StandardProductWriteInput } from "@/lib/radar/writers/standard-product-writer"
export { toStandardGMCFeed, toGmcFeedRow, gmcFeedId } from "@/lib/radar/writers/gmc-mapper"
