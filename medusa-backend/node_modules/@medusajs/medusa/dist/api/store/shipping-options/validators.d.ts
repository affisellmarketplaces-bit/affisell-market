import { z } from "@medusajs/framework/zod";
export declare const StoreGetShippingOptionsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StoreGetShippingOptionsFields: z.ZodObject<{
    cart_id: z.ZodString;
    is_return: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
}, z.core.$strict>;
export type StoreGetShippingOptionsType = z.infer<typeof StoreGetShippingOptions>;
export declare const StoreGetShippingOptions: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        cart_id: z.ZodString;
        is_return: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    }, z.core.$strict>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        cart_id: z.ZodString;
        is_return: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    }, z.core.$strict>>>>;
}, z.core.$strip>;
export type StoreCalculateShippingOptionPriceType = z.infer<typeof StoreCalculateShippingOptionPrice>;
export declare const StoreCalculateShippingOptionPrice: z.ZodObject<{
    cart_id: z.ZodString;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map