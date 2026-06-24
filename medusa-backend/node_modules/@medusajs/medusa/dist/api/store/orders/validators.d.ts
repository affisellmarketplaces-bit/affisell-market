import { z } from "@medusajs/framework/zod";
export declare const StoreGetOrderParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StoreGetOrderParamsType = z.infer<typeof StoreGetOrderParams>;
export declare const StoreGetOrdersParamsFields: z.ZodObject<{
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export declare const StoreGetOrdersParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type StoreGetOrdersParamsType = z.infer<typeof StoreGetOrdersParams>;
export type StoreAcceptOrderTransferType = z.infer<typeof StoreAcceptOrderTransfer>;
export declare const StoreAcceptOrderTransfer: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
export type StoreRequestOrderTransferType = z.infer<typeof StoreRequestOrderTransfer>;
export declare const StoreRequestOrderTransfer: z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
    update_order_email: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type StoreDeclineOrderTransferRequestType = z.infer<typeof StoreDeclineOrderTransferRequest>;
export declare const StoreDeclineOrderTransferRequest: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map