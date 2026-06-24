import type { OrderChangeDTO, OrderDTO, PromotionDTO } from "@medusajs/framework/types";
/**
 * The ID of the compute draft order adjustments workflow.
 */
export declare const computeDraftOrderAdjustmentsWorkflowId = "compute-draft-order-adjustments";
/**
 * The details of the draft order to refresh the adjustments for.
 */
export interface ComputeDraftOrderAdjustmentsWorkflowInput {
    /**
     * The ID of the draft order to refresh the adjustments for.
     */
    order_id: string;
}
/**
 * This workflow computes the adjustments or promotions for a draft order. It's used by other workflows
 * to compute new adjustments for the promotions whenever changes are made to the draft order.
 * Created adjustments are "virtual" meaning they live on the action and no line item adjustments records are created
 * in the database until the edit is confirmed.
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to wrap custom logic around
 * computing the adjustments for a draft order.
 *
 * @example
 * const { result } = await computeDraftOrderAdjustmentsWorkflow(container)
 * .run({
 *   input: {
 *     order_id: "order_123",
 *   }
 * })
 *
 * @summary
 *
 * Refresh the promotions in a draft order.
 *
 * @property hooks.setPromotionContext - This hook is executed before promotion rules are evaluated for the draft order. You can consume this hook to return any custom context that should be merged on top of the order context when evaluating promotion rules (e.g. `company.id`, `custom_tier`).
 */
export declare const computeDraftOrderAdjustmentsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<ComputeDraftOrderAdjustmentsWorkflowInput, undefined, [import("@medusajs/framework/workflows-sdk").Hook<"setPromotionContext", {
    order: OrderDTO & {
        promotions: PromotionDTO[];
    };
    orderChange: OrderChangeDTO;
}, Record<string, any> | undefined>]>;
//# sourceMappingURL=compute-draft-order-adjustments.d.ts.map