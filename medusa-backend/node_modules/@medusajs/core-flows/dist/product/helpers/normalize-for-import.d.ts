import type { ProductTypes } from "@medusajs/framework/types";
import type { HttpTypes, RegionTypes } from "@medusajs/framework/types";
/**
 * Normalizes raw CSV product data into standardized AdminCreateProduct DTOs.
 *
 * This function converts product data from CSV import format to the standard DTO format
 * expected by the product creation API. It handles product grouping by handle,
 * variant aggregation, option extraction, and validation against existing regions and tags.
 *
 * @param rawProducts - Array of raw product objects from CSV import
 * @param additional - Additional context data needed for normalization
 * @param additional.regions - Available regions for price validation
 * @param additional.tags - Available product tags for validation
 * @returns Array of normalized AdminCreateProduct DTOs ready for import
 *
 * @throws {MedusaError} When referenced tags or regions are not found
 *
 * @example
 * ```typescript
 * const products = normalizeForImport(csvData, {
 *   regions: existingRegions,
 *   tags: existingTags
 * })
 * ```
 */
export declare const normalizeForImport: (rawProducts: object[], additional: {
    regions: RegionTypes.RegionDTO[];
    tags: ProductTypes.ProductTagDTO[];
}) => HttpTypes.AdminCreateProduct[];
//# sourceMappingURL=normalize-for-import.d.ts.map