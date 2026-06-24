import { WorkflowTypes } from "@medusajs/types";
/**
 * The step ID for exporting products.
 */
export declare const exportProductsStepId = "export-products";
/**
 * This step exports products to a CSV file based on the provided filters.
 *
 * @example
 * To export all products:
 *
 * ```ts
 * const data = exportProductsStep({
 *   select: ["id", "title", "handle"],
 *   batch_size: 100
 * })
 * ```
 *
 * To export products from a specific sales channel:
 *
 * ```ts
 * const data = exportProductsStep({
 *   select: ["id", "title", "handle"],
 *   filter: {
 *     sales_channel_id: "sc_123"
 *   }
 * })
 * ```
 */
export declare const exportProductsStep: import("@medusajs/framework/workflows-sdk").StepFunction<WorkflowTypes.ProductWorkflow.ExportProductsDTO, {
    id: string;
    filename: string;
}>;
//# sourceMappingURL=export-products.d.ts.map