/** Supplier / affiliate only — not marketplace buyers. */
export function canDownloadSupplierAdVideos(role: string | undefined | null): boolean {
  return role === "SUPPLIER" || role === "AFFILIATE"
}
