"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAdjustmentsForPreviewWorkflow = exports.computeAdjustmentsForPreviewWorkflowId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const cart_1 = require("../../cart");
const schemas_1 = require("../../cart/utils/schemas");
const preview_order_change_1 = require("../steps/preview-order-change");
const create_order_change_actions_1 = require("./create-order-change-actions");
const steps_1 = require("../steps");
const prepare_order_compute_action_context_1 = require("./order-edit/utils/prepare-order-compute-action-context");
/**
 * The ID of the compute adjustments for preview workflow.
 */
exports.computeAdjustmentsForPreviewWorkflowId = "compute-adjustments-for-preview";
/**
 * This workflow computes adjustments for an order change if the carry over promotions flag is true on the order change.
 * If the flag is false, it deletes the existing adjustments replacement actions.
 *
 * It is currently used as a part of the order edit and exchange flows. It's used by workflows
 * like {@link orderExchangeAddNewItemWorkflow} and {@link orderEditAddNewItemWorkflow}.
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to compute adjustments
 * in your custom flows.
 *
 * @since 2.12.0
 *
 * @example
 * const { result } = await computeAdjustmentsForPreviewWorkflow(container)
 * .run({
 *   input: {
 *     order: {
 *       id: "order_123",
 *       // other order details...
 *     },
 *     orderChange: {
 *       id: "orch_123",
 *       // other order change details...
 *     },
 *   }
 * })
 *
 * @summary
 *
 * Compute adjustments for an order edit, exchange, claim, or return.
 *
 * @property hooks.setPromotionContext - This hook is executed before promotion rules are evaluated for the previewed order. You can consume this hook to return any custom context that should be merged on top of the order context when evaluating promotion rules (e.g. `company.id`, `custom_tier`).
 */
exports.computeAdjustmentsForPreviewWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.computeAdjustmentsForPreviewWorkflowId, function (input) {
    const previewedOrder = (0, preview_order_change_1.previewOrderChangeStep)(input.order.id);
    const setPromotionContext = (0, workflows_sdk_1.createHook)("setPromotionContext", {
        order: input.order,
        orderChange: input.orderChange,
        previewedOrder,
    }, {
        resultValidator: schemas_1.promotionContextResult,
    });
    const setPromotionContextResult = setPromotionContext.getResult();
    (0, workflows_sdk_1.when)({ order: input.order, orderChange: input.orderChange }, ({ order, orderChange }) => 
    /**
     * Compute adjustments only if the flag on the order change is true
     */
    !!order.promotions.length && !!orderChange.carry_over_promotions).then(() => {
        const actionsToComputeItemsInput = (0, prepare_order_compute_action_context_1.prepareOrderComputeActionContextStep)({
            order: input.order,
            previewedOrder,
        });
        const orderPromotions = (0, workflows_sdk_1.transform)({ order: input.order }, ({ order }) => {
            return order.promotions
                .map((p) => p.code)
                .filter((p) => p !== undefined);
        });
        const actions = (0, cart_1.getActionsToComputeFromPromotionsStep)({
            computeActionContext: actionsToComputeItemsInput,
            promotionCodesToApply: orderPromotions,
            options: {
                skip_usage_limit_checks: true,
            },
            additional_promotion_context: setPromotionContextResult,
        });
        const { lineItemAdjustmentsToCreate, shippingMethodAdjustmentsToCreate } = (0, cart_1.prepareAdjustmentsFromPromotionActionsStep)({ actions });
        const orderChangeActionAdjustmentsInput = (0, workflows_sdk_1.transform)({
            order: input.order,
            previewedOrder,
            orderChange: input.orderChange,
            lineItemAdjustmentsToCreate,
            shippingMethodAdjustmentsToCreate,
        }, ({ order, previewedOrder, orderChange, lineItemAdjustmentsToCreate, shippingMethodAdjustmentsToCreate, }) => {
            const itemActions = previewedOrder.items.map((item) => {
                const itemAdjustments = lineItemAdjustmentsToCreate.filter((adjustment) => adjustment.item_id === item.id);
                return {
                    order_change_id: orderChange.id,
                    order_id: order.id,
                    exchange_id: orderChange.exchange_id ?? undefined,
                    claim_id: orderChange.claim_id ?? undefined,
                    return_id: orderChange.return_id ?? undefined,
                    version: orderChange.version,
                    action: utils_1.ChangeActionType.ITEM_ADJUSTMENTS_REPLACE,
                    details: {
                        reference_id: item.id,
                        adjustments: itemAdjustments,
                    },
                };
            });
            const shippingActions = previewedOrder.shipping_methods.map((shippingMethod) => {
                const shippingAdjustments = shippingMethodAdjustmentsToCreate.filter((adjustment) => adjustment.shipping_method_id === shippingMethod.id);
                return {
                    order_change_id: orderChange.id,
                    order_id: order.id,
                    exchange_id: orderChange.exchange_id ?? undefined,
                    claim_id: orderChange.claim_id ?? undefined,
                    return_id: orderChange.return_id ?? undefined,
                    version: orderChange.version,
                    action: utils_1.ChangeActionType.SHIPPING_ADJUSTMENTS_REPLACE,
                    details: {
                        reference_id: shippingMethod.id,
                        adjustments: shippingAdjustments,
                    },
                };
            });
            return [...itemActions, ...shippingActions];
        });
        create_order_change_actions_1.createOrderChangeActionsWorkflow
            .runAsStep({ input: orderChangeActionAdjustmentsInput })
            .config({ name: "order-change-action-adjustments-input" });
    });
    (0, workflows_sdk_1.when)({ order: previewedOrder }, ({ order }) => !order.order_change.carry_over_promotions).then(() => {
        const itemActionIds = (0, steps_1.listOrderChangeActionsByTypeStep)({
            order_change_id: input.orderChange.id,
            action_type: utils_1.ChangeActionType.ITEM_ADJUSTMENTS_REPLACE,
        }).config({ name: "list-item-adjustment-actions-for-deletion" });
        const shippingActionIds = (0, steps_1.listOrderChangeActionsByTypeStep)({
            order_change_id: input.orderChange.id,
            action_type: utils_1.ChangeActionType.SHIPPING_ADJUSTMENTS_REPLACE,
        }).config({ name: "list-shipping-adjustment-actions-for-deletion" });
        const allActionIds = (0, workflows_sdk_1.transform)({ itemActionIds, shippingActionIds }, ({ itemActionIds, shippingActionIds }) => {
            return [...itemActionIds, ...shippingActionIds];
        });
        (0, steps_1.deleteOrderChangeActionsStep)({ ids: allActionIds });
    });
    return new workflows_sdk_1.WorkflowResponse(void 0, {
        hooks: [setPromotionContext],
    });
});
//# sourceMappingURL=compute-adjustments-for-preview.js.map