import { z } from "@medusajs/framework/zod";
export type StoreGetPaymentCollectionParamsType = z.infer<typeof StoreGetPaymentCollectionParams>;
export declare const StoreGetPaymentCollectionParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StoreCreatePaymentSessionType = z.infer<typeof StoreCreatePaymentSession>;
export declare const StoreCreatePaymentSession: z.ZodObject<{
    provider_id: z.ZodString;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export type StoreCreatePaymentCollectionType = z.infer<typeof StoreCreatePaymentCollection>;
export declare const StoreCreatePaymentCollection: z.ZodObject<{
    cart_id: z.ZodString;
}, z.core.$strict>;
//# sourceMappingURL=validators.d.ts.map