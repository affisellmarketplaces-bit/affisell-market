import { z } from "@medusajs/framework/zod";
export type ReturnParamsType = z.infer<typeof ReturnParams>;
export declare const ReturnParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ReturnsParamsFields: z.ZodObject<{
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    order_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type ReturnsParamsType = z.infer<typeof ReturnsParams>;
export declare const ReturnsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        order_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        order_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export declare const StorePostReturnsReqSchema: z.ZodObject<{
    order_id: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        reason_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    return_shipping: z.ZodObject<{
        option_id: z.ZodString;
        price: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    receive_now: z.ZodOptional<z.ZodBoolean>;
    location_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type StorePostReturnsReqSchemaType = z.infer<typeof StorePostReturnsReqSchema>;
//# sourceMappingURL=validators.d.ts.map