/**
 * The data to remove prices.
 */
export type RemovePriceListPricesWorkflowInput = {
    /**
     * The IDs of the prices to remove.
     */
    ids: string[];
};
export declare const removePriceListPricesWorkflowId = "remove-price-list-prices";
/**
 * This workflow removes prices. It's used by other workflows, such
 * as {@link batchPriceListPricesWorkflow}.
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to
 * remove prices in your custom flows.
 *
 * @example
 * const { result } = await removePriceListPricesWorkflow(container)
 * .run({
 *   input: {
 *     ids: ["price_123"]
 *   }
 * })
 *
 * @summary
 *
 * Remove prices.
 */
export declare const removePriceListPricesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<RemovePriceListPricesWorkflowInput, string[], []>;
//# sourceMappingURL=remove-price-list-prices.d.ts.map