import { OrderChangeDTO, OrderDTO, PromotionDTO } from "@medusajs/framework/types";
import { WorkflowData } from "@medusajs/framework/workflows-sdk";
/**
 * The data to compute adjustments for an order edit, exchange, claim, or return.
 */
export type ComputeAdjustmentsForPreviewWorkflowInput = {
    /**
     * The order's details.
     */
    order: OrderDTO & {
        /**
         * The promotions applied to the order.
         */
        promotions: PromotionDTO[];
    };
    /**
     * The order change's details.
     */
    orderChange: OrderChangeDTO;
};
/**
 * The ID of the compute adjustments for preview workflow.
 */
export declare const computeAdjustmentsForPreviewWorkflowId = "compute-adjustments-for-preview";
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
export declare const computeAdjustmentsForPreviewWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<ComputeAdjustmentsForPreviewWorkflowInput, undefined, [import("@medusajs/framework/workflows-sdk").Hook<"setPromotionContext", {
    order: OrderDTO & {
        /**
         * The promotions applied to the order.
         */
        promotions: PromotionDTO[];
    };
    orderChange: OrderChangeDTO;
    previewedOrder: import("@medusajs/framework/types").OrderPreviewDTO & import("@medusajs/framework/workflows-sdk").WorkflowDataProperties<import("@medusajs/framework/types").OrderPreviewDTO> & {
        config(config: {
            name?: string;
        } & Omit<import("@medusajs/orchestration").TransactionStepsDefinition, "next" | "uuid" | "action">): WorkflowData<import("@medusajs/framework/types").OrderPreviewDTO>;
    } & import("@medusajs/framework/workflows-sdk").StepFunctionReturnConfig<import("@medusajs/framework/types").OrderPreviewDTO>;
}, Record<string, any> | undefined>]>;
//# sourceMappingURL=compute-adjustments-for-preview.d.ts.map