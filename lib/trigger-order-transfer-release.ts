import { enqueueProcessTransfersJob } from "@/lib/transfers/enqueue-job"

/** Re-run Connect transfers when an order may have become release-eligible. */
export function triggerOrderTransferRelease(orderId: string): void {
  console.log("[transfer-gating]", { orderId, action: "enqueue_release_check" })
  void enqueueProcessTransfersJob()
}
