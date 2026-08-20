export type UnifiedTrackingParcel = {
  id: string
  index: number
  status: string
  provider: string | null
  externalOrderId: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  trackingUrl: string | null
  manualNote: string | null
  error: string | null
  items: Array<{
    orderId: string
    quantity: number
    productName: string
  }>
}

export type UnifiedTrackingView = {
  orderId: string
  stripeSessionId: string
  parcelCount: number
  groups: UnifiedTrackingParcel[]
}
