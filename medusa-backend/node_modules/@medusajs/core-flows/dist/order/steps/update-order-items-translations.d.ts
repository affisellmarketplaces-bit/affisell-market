export interface UpdateOrderItemsTranslationsStepInput {
    order_id: string;
    locale: string;
    /**
     * Pre-loaded items to avoid re-fetching.
     */
    items?: {
        id: string;
        variant_id?: string;
        [key: string]: any;
    }[];
}
export declare const updateOrderItemsTranslationsStepId = "update-order-items-translations";
/**
 * This step re-translates all order line items when the order's locale changes.
 * It fetches items and their variants in batches to handle large orders gracefully.
 */
export declare const updateOrderItemsTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateOrderItemsTranslationsStepInput, undefined>;
//# sourceMappingURL=update-order-items-translations.d.ts.map