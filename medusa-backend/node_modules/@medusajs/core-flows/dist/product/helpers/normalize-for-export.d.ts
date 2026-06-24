import { HttpTypes, RegionTypes } from "@medusajs/framework/types";
/**
 * Normalizes product data for export, creating one row per product variant.
 * Products without variants will have a single row, while products with variants
 * will have one row per variant containing both product and variant data.
 *
 * @param product - The array of products to normalize for export.
 * @param regions - Object containing an array of region data used for price formatting.
 * @returns An array of normalized objects ready for export, with flattened product and variant data.
 *
 * @example
 * const normalizedData = normalizeForExport(
 *   [productA, productB],
 *   { regions: [region1, region2] }
 * )
 */
export declare const normalizeForExport: (product: HttpTypes.AdminProduct[], { regions }: {
    regions: RegionTypes.RegionDTO[];
}) => object[];
//# sourceMappingURL=normalize-for-export.d.ts.map