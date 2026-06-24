import { z } from "@medusajs/framework/zod";
export declare const AdminGetPricePreferenceParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetPricePreferencesParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    attribute: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export declare const AdminGetPricePreferencesParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        attribute: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        attribute: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export declare const AdminCreatePricePreference: z.ZodObject<{
    attribute: z.ZodString;
    value: z.ZodString;
    is_tax_inclusive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminCreatePricePreferencePriceType = z.infer<typeof AdminCreatePricePreference>;
export declare const AdminUpdatePricePreference: z.ZodObject<{
    attribute: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    is_tax_inclusive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminUpdatePricePreferenceType = z.infer<typeof AdminUpdatePricePreference>;
//# sourceMappingURL=validators.d.ts.map