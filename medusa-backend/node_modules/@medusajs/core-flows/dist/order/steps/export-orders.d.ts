import { FilterableOrderProps } from "@medusajs/framework/types";
export type ExportOrdersStepInput = {
    batch_size?: number | string;
    select: string[];
    filter?: FilterableOrderProps;
};
export type ExportOrdersStepOutput = {
    id: string;
    filename: string;
};
export declare const exportOrdersStepId = "export-orders";
export declare const exportOrdersStep: import("@medusajs/framework/workflows-sdk").StepFunction<ExportOrdersStepInput, ExportOrdersStepOutput>;
//# sourceMappingURL=export-orders.d.ts.map