import { OrderShippingMethodDTO } from "@medusajs/types";
export declare const updateOrderShippingMethodsTranslationsStepId = "update-order-shipping-methods-translations";
export interface UpdateOrderShippingMethodsTranslationsStepInput {
    shippingMethods: OrderShippingMethodDTO[];
    locale: string;
}
/**
 * This step updates the names of order shipping methods based on the provided locale.
 * It fetches the translated names of the shipping option associated with each shipping method
 * and updates the shipping methods accordingly.
 *
 * @since 2.12.4
 *
 * @example
 * const updatedShippingMethods = updateOrderShippingMethodsTranslationsStep({
 *   shippingMethods: [
 *     {
 *       id: "sm_123",
 *       shipping_option_id: "so_123",
 *       name: "Standard Shipping",
 *       // ...
 *     }
 *   ],
 *   locale: "fr-FR"
 * })
 */
export declare const updateOrderShippingMethodsTranslationsStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateOrderShippingMethodsTranslationsStepInput, OrderShippingMethodDTO[]>;
//# sourceMappingURL=update-order-shipping-methods-translations.d.ts.map