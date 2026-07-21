/** Notification.type values for ProductRequest / ProductQuote loop. */
export const PRODUCT_REQUEST_NOTIF = {
  NEW_REQUEST: "PRODUCT_REQUEST",
  NEW_QUOTE: "PRODUCT_QUOTE",
  QUOTE_ACCEPTED: "PRODUCT_QUOTE_ACCEPTED",
  REQUEST_FULFILLED: "PRODUCT_REQUEST_FULFILLED",
} as const

export type ProductRequestNotifType =
  (typeof PRODUCT_REQUEST_NOTIF)[keyof typeof PRODUCT_REQUEST_NOTIF]

export const PRODUCT_REQUEST_NOTIF_TYPES: ProductRequestNotifType[] = [
  PRODUCT_REQUEST_NOTIF.NEW_REQUEST,
  PRODUCT_REQUEST_NOTIF.NEW_QUOTE,
  PRODUCT_REQUEST_NOTIF.QUOTE_ACCEPTED,
  PRODUCT_REQUEST_NOTIF.REQUEST_FULFILLED,
]

export function isProductRequestNotifType(type: string): type is ProductRequestNotifType {
  return (PRODUCT_REQUEST_NOTIF_TYPES as string[]).includes(type)
}
