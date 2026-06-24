import { z } from "@medusajs/framework/zod";
export type StoreGetPaymentProvidersParamsType = z.infer<typeof StoreGetPaymentProvidersParams>;
export declare const StoreGetPaymentProvidersParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    region_id: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map