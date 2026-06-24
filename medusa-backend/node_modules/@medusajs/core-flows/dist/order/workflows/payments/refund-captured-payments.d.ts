import type { PaymentDTO } from "@medusajs/framework/types";
export declare const refundCapturedPaymentsWorkflowId = "refund-captured-payments-workflow";
/**
 * This workflow refunds a payment.
 */
export declare const refundCapturedPaymentsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<{
    order_id: string;
    created_by?: string;
    note?: string;
}, PaymentDTO[], []>;
//# sourceMappingURL=refund-captured-payments.d.ts.map