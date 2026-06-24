import { TransactionHandlerType } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
export type AdminGetWorkflowExecutionDetailsParamsType = z.infer<typeof AdminGetWorkflowExecutionDetailsParams>;
export declare const AdminGetWorkflowExecutionDetailsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetWorkflowExecutionsParamsType = z.infer<typeof AdminGetWorkflowExecutionsParams>;
export declare const AdminGetWorkflowExecutionsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    q: z.ZodOptional<z.ZodString>;
    transaction_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    workflow_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    state: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    created_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type AdminCreateWorkflowsRunType = z.infer<typeof AdminCreateWorkflowsRun>;
export declare const AdminCreateWorkflowsRun: z.ZodObject<{
    input: z.ZodOptional<z.ZodAny>;
    transaction_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminCreateWorkflowsAsyncResponseType = z.infer<typeof AdminCreateWorkflowsAsyncResponse>;
export declare const AdminCreateWorkflowsAsyncResponse: z.ZodObject<{
    transaction_id: z.ZodString;
    step_id: z.ZodString;
    response: z.ZodOptional<z.ZodAny>;
    compensate_input: z.ZodOptional<z.ZodAny>;
    action: z.ZodOptional<z.ZodPipe<z.ZodTransform<string, any>, z.ZodOptional<z.ZodEnum<typeof TransactionHandlerType>>>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map