/** Large supplier writes (variants + base64 images) can exceed the default 5s interactive tx. */
export const SUPPLIER_PRODUCT_WRITE_TX = {
  timeout: 30_000,
  maxWait: 10_000,
} as const
