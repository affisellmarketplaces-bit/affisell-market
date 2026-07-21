/** Shared ImportJob product payload — safe for client + server. */
export type RadarImportJobProduct = {
  winnerId: string
  title: string
  imageUrl: string | null
  price: number | null
  arbitrageScore: number | null
  /** Optional resolver hints (stored in JSON, not Prisma columns). */
  productId?: string | null
  source?: string | null
  catalogListingId?: string | null
  importedListingId?: string | null
  importError?: string | null
}

export type RadarImportDestination = "affisell_catalog" | "supplier_draft"

export type RadarImportJobStatus = "pending" | "processing" | "completed" | "failed"
