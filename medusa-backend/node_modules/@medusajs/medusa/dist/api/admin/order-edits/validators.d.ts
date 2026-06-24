import { z } from "@medusajs/framework/zod";
export declare const AdminPostOrderEditsReqSchema: z.ZodObject<{
    order_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostOrderEditsReqSchemaType = z.infer<typeof AdminPostOrderEditsReqSchema>;
export declare const AdminPostOrderEditsShippingReqSchema: z.ZodObject<{
    shipping_option_id: z.ZodString;
    custom_amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AdminPostOrderEditsShippingReqSchemaType = z.infer<typeof AdminPostOrderEditsShippingReqSchema>;
export declare const AdminPostOrderEditsShippingActionReqSchema: z.ZodObject<{
    custom_amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostOrderEditsShippingActionReqSchemaType = z.infer<typeof AdminPostOrderEditsShippingActionReqSchema>;
export declare const AdminPostOrderEditsAddItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        variant_id: z.ZodString;
        quantity: z.ZodNumber;
        unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        compare_at_unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        internal_note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        allow_backorder: z.ZodOptional<z.ZodBoolean>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostOrderEditsAddItemsReqSchemaType = z.infer<typeof AdminPostOrderEditsAddItemsReqSchema>;
export declare const AdminPostOrderEditsItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    compare_at_unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostOrderEditsItemsActionReqSchemaType = z.infer<typeof AdminPostOrderEditsItemsActionReqSchema>;
export declare const AdminPostOrderEditsUpdateItemQuantityReqSchema: z.ZodObject<{
    quantity: z.ZodNumber;
    unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    compare_at_unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostOrderEditsUpdateItemQuantityReqSchemaType = z.infer<typeof AdminPostOrderEditsUpdateItemQuantityReqSchema>;
//# sourceMappingURL=validators.d.ts.map