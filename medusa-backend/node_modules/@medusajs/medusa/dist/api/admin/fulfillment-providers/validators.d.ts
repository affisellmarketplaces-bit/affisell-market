import { z } from "@medusajs/framework/zod";
export type AdminFulfillmentProvidersParamsType = z.infer<typeof AdminFulfillmentProvidersParams>;
export declare const AdminFulfillmentProvidersParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    stock_location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    is_enabled: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
//# sourceMappingURL=validators.d.ts.map