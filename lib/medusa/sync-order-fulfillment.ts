import "server-only"

export {
  buildMedusaShipmentLabels,
  isMedusaOrderFullyShipped,
  medusaShipmentAlreadyRecorded,
  pendingMedusaFulfillmentItems,
  syncAffisellShipmentToMedusaIfNeeded,
  type MedusaOrderSnapshot,
  type SyncAffisellShipmentToMedusaInput,
} from "@/lib/medusa/sync-order-fulfillment.impl"
