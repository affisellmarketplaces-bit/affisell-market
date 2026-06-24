"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCartPromotionsWorkflow = exports.updateCartPromotionsWorkflowId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const common_1 = require("../../common");
const locking_1 = require("../../locking");
const steps_1 = require("../steps");
const update_cart_promotions_1 = require("../steps/update-cart-promotions");
const fields_1 = require("../utils/fields");
const schemas_1 = require("../utils/schemas");
const refresh_payment_collection_1 = require("./refresh-payment-collection");
exports.updateCartPromotionsWorkflowId = "update-cart-promotions";
/**
 * This workflow updates a cart's promotions, applying or removing promotion codes from the cart. It also computes the adjustments
 * that need to be applied to the cart's line items and shipping methods based on the promotions applied. This workflow is used by
 * [Add Promotions Store API Route](https://docs.medusajs.com/api/store#carts_postcartsidpromotions).
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you to update a cart's promotions within your custom flows.
 *
 * @example
 * const { result } = await updateCartPromotionsWorkflow(container)
 * .run({
 *   input: {
 *     cart_id: "cart_123",
 *     promo_codes: ["10OFF"],
 *     // imported from @medusajs/framework/utils
 *     action: PromotionActions.ADD,
 *   }
 * })
 *
 * @summary
 *
 * Update a cart's applied promotions to add, replace, or remove them.
 *
 * @property hooks.validate - This hook is executed before all operations. You can consume this hook to perform any custom validation. If validation fails, you can throw an error to stop the workflow execution.
 * @property hooks.setPromotionContext - This hook is executed after the cart is fetched and before promotion rules are evaluated. You can consume this hook to add custom rules that determine whether a promotion is applied. The returned object is merged on top of the cart context, allowing you to override existing context.
 */
exports.updateCartPromotionsWorkflow = (0, workflows_sdk_1.createWorkflow)({
    name: exports.updateCartPromotionsWorkflowId,
    idempotent: false,
}, (input) => {
    const cartId = (0, workflows_sdk_1.transform)({ input }, ({ input }) => {
        return input.cart_id ?? input.cart?.id;
    });
    (0, locking_1.acquireLockStep)({
        key: cartId,
        timeout: 2,
        ttl: 10,
    });
    const fetchCart = (0, workflows_sdk_1.when)("should-fetch-cart", { input }, ({ input }) => {
        return !input.cart;
    }).then(() => {
        const { data: cart } = (0, common_1.useQueryGraphStep)({
            entity: "cart",
            fields: fields_1.cartFieldsForRefreshSteps,
            filters: { id: input.cart_id },
            options: { isList: false },
        }).config({ name: "fetch-cart" });
        return cart;
    });
    const cart = (0, workflows_sdk_1.transform)({ fetchCart, input }, ({ fetchCart, input }) => {
        return input.cart ?? fetchCart;
    });
    (0, steps_1.validateCartStep)({ cart });
    const validate = (0, workflows_sdk_1.createHook)("validate", {
        input,
        cart,
    });
    const promo_codes = (0, workflows_sdk_1.transform)({ input }, (data) => {
        return (data.input.promo_codes || []);
    });
    const action = (0, workflows_sdk_1.transform)({ input }, (data) => {
        return data.input.action || utils_1.PromotionActions.ADD;
    });
    const setPromotionContext = (0, workflows_sdk_1.createHook)("setPromotionContext", {
        cart,
        action,
        promo_codes,
    }, {
        resultValidator: schemas_1.promotionContextResult,
    });
    const setPromotionContextResult = setPromotionContext.getResult();
    const promotionCodesToApply = (0, steps_1.getPromotionCodesToApply)({
        cart: cart,
        promo_codes,
        action: action,
    });
    const actions = (0, steps_1.getActionsToComputeFromPromotionsStep)({
        computeActionContext: cart,
        promotionCodesToApply,
        additional_promotion_context: setPromotionContextResult,
    });
    const { lineItemAdjustmentsToCreate, lineItemAdjustmentIdsToRemove, shippingMethodAdjustmentsToCreate, shippingMethodAdjustmentIdsToRemove, computedPromotionCodes, skippedPromoCodes, } = (0, steps_1.prepareAdjustmentsFromPromotionActionsStep)({ actions });
    (0, workflows_sdk_1.parallelize)((0, steps_1.removeLineItemAdjustmentsStep)({ lineItemAdjustmentIdsToRemove }), (0, steps_1.removeShippingMethodAdjustmentsStep)({
        shippingMethodAdjustmentIdsToRemove,
    }), (0, steps_1.createLineItemAdjustmentsStep)({ lineItemAdjustmentsToCreate }), (0, steps_1.createShippingMethodAdjustmentsStep)({
        shippingMethodAdjustmentsToCreate,
    }), (0, update_cart_promotions_1.updateCartPromotionsStep)({
        id: cart.id,
        promo_codes: computedPromotionCodes,
        action: utils_1.PromotionActions.REPLACE,
    }));
    (0, workflows_sdk_1.when)({ input }, ({ input }) => input.force_refresh_payment_collection === true).then(() => {
        refresh_payment_collection_1.refreshPaymentCollectionForCartWorkflow.runAsStep({
            input: { cart },
        });
    });
    (0, locking_1.releaseLockStep)({
        key: cartId,
    });
    return new workflows_sdk_1.WorkflowResponse({ skipped_promo_codes: skippedPromoCodes }, { hooks: [validate, setPromotionContext] });
});
//# sourceMappingURL=update-cart-promotions.js.map