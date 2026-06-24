import type { ComputeActionContext, OrderDTO, OrderPreviewDTO } from "@medusajs/framework/types";
/**
 * The details of the order to prepare compute actions for.
 */
export interface PrepareOrderComputeActionContextStepInput {
    /**
     * The order.
     */
    order: OrderDTO;
    /**
     * The previewed order after applying the order change.
     */
    previewedOrder: OrderPreviewDTO;
}
export declare const prepareOrderComputeActionContextStepId = "prepare-order-compute-action-context";
/**
 * This step prepares the compute action context for an order by enriching
 * previewed items and shipping methods with external entities.
 *
 * Order `preview` doesn't return related entities from external modules
 * and order itself could have stale entitites depending on the change action
 * so we need to prepare some data "manually" to make sure the compute action context is correct
 */
export declare const prepareOrderComputeActionContextStep: import("@medusajs/framework/workflows-sdk").StepFunction<PrepareOrderComputeActionContextStepInput, ComputeActionContext>;
//# sourceMappingURL=prepare-order-compute-action-context.d.ts.map