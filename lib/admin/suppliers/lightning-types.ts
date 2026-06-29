export type AdminLightningSupplierRow = {
  userId: string
  email: string
  name: string | null
  storeName: string | null
  storeSlug: string | null
  partnerListingCode: string | null
  trustScore: number
  lightningEnabled: boolean
  lightningAdminOverride: boolean
  stripeAccountId: string | null
}

export type AdminLightningSuppliersResponse = {
  rows: AdminLightningSupplierRow[]
  counts: {
    total: number
    lightningOn: number
    adminOverride: number
  }
}
