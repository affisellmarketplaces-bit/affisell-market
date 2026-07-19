/** @deprecated Prefer product-writer — re-export for existing imports. */
export {
  upsertGlobalSnapshot,
  upsertProductSnapshot,
  utcDay,
} from "@/lib/radar/writers/product-writer"
export type {
  GlobalSnapshotWriteInput,
  GlobalSnapshotWriteResult,
  ProductSnapshotWriteInput,
  ProductSnapshotWriteResult,
} from "@/lib/radar/writers/product-writer"
