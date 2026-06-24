import { z } from "@medusajs/framework/zod";
export type AdminGetStoreParamsType = z.infer<typeof AdminGetStoreParams>;
export declare const AdminGetStoreParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetStoresParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type AdminGetStoresParamsType = z.infer<typeof AdminGetStoresParams>;
export declare const AdminGetStoresParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type AdminUpdateStoreType = z.infer<typeof AdminUpdateStore>;
export declare const AdminUpdateStore: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    supported_currencies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        currency_code: z.ZodString;
        is_default: z.ZodOptional<z.ZodBoolean>;
        is_tax_inclusive: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    supported_locales: z.ZodOptional<z.ZodArray<z.ZodObject<{
        locale_code: z.ZodString;
    }, z.core.$strip>>>;
    default_sales_channel_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    default_region_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    default_location_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map