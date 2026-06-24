export declare const updateOrderTaxLinesTranslationsStepId = "update-order-tax-lines-translations";
interface UpdateOrderTaxLinesTranslationsStepInput {
    order_id: string;
    locale: string;
}
/**
 * This step updates the tax line descriptions of an order based on the provided locale.
 * It retrieves the original tax lines, applies translations, and updates the order accordingly.
 * In case of failure, it compensates by restoring the original tax line descriptions.
 *
 * @since 2.13.0
 *
 * @example
 * const result = updateOrderTaxLinesTranslationsStep({
 *   order_id: "order_123",
 *   locale: "fr-FR"
 * })
 */
export declare const updateOrderTaxLinesTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateOrderTaxLinesTranslationsStepInput, undefined>;
export {};
//# sourceMappingURL=update-order-tax-lines-translations.d.ts.map