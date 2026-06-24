import { z } from "@medusajs/framework/zod";
export declare const AdminGetTaxProvidersParamsFields: z.ZodObject<{
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    is_enabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminGetTaxProvidersParamsFieldsType = z.infer<typeof AdminGetTaxProvidersParamsFields>;
export type AdminGetTaxProvidersParamsType = z.infer<typeof AdminGetTaxProvidersParams>;
export declare const AdminGetTaxProvidersParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        is_enabled: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        is_enabled: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map