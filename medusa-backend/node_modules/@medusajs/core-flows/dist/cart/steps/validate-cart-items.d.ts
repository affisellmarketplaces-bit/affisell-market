import type { CartWorkflowDTO } from "@medusajs/framework/types";
/**
 * The input for the validate cart items step.
 *
 * @since 2.14.3
 */
export interface ValidateCartItemsStepInput {
    /**
     * The cart to validate.
     */
    cart: CartWorkflowDTO;
}
/**
 * The ID of the validate cart items step.
 *
 * @since 2.14.3
 */
export declare const validateCartItemsStepId = "validate-cart-items";
/**
 * This step validates that a cart has at least one line item before
 * completing the cart and placing an order. If the cart has no items,
 * the step throws an error.
 *
 * @example
 * validateCartItemsStep({
 *   cart
 * })
 *
 * @since 2.14.3
 */
export declare const validateCartItemsStep: import("@medusajs/framework/workflows-sdk").StepFunction<ValidateCartItemsStepInput, undefined>;
//# sourceMappingURL=validate-cart-items.d.ts.map