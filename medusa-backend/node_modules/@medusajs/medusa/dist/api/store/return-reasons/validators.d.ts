import { z } from "@medusajs/framework/zod";
export type StoreReturnReasonParamsType = z.infer<typeof StoreReturnReasonParams>;
export declare const StoreReturnReasonParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StoreReturnReasonsParamsType = z.infer<typeof StoreReturnReasonsParams>;
export declare const StoreReturnReasonsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map