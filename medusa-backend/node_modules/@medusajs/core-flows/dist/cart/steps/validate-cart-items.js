"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCartItemsStep = exports.validateCartItemsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * The ID of the validate cart items step.
 *
 * @since 2.14.3
 */
exports.validateCartItemsStepId = "validate-cart-items";
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
exports.validateCartItemsStep = (0, workflows_sdk_1.createStep)(exports.validateCartItemsStepId, async (data) => {
    const { cart } = data;
    if (!cart.items?.length) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Cannot complete a cart with no items`);
    }
    return new workflows_sdk_1.StepResponse(void 0);
});
//# sourceMappingURL=validate-cart-items.js.map