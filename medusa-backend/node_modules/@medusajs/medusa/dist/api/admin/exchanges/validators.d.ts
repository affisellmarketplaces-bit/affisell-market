import { z } from "@medusajs/framework/zod";
export declare const AdminGetExchangeParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetExchangeParamsType = z.infer<typeof AdminGetExchangeParams>;
export declare const AdminGetOrdersOrderParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    created_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
    updated_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
    deleted_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type AdminGetOrdersOrderParamsType = z.infer<typeof AdminGetOrdersOrderParams>;
export declare const AdminGetOrdersParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    order_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    created_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
    updated_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
    deleted_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
        $eq: any;
        $ne: any;
        $in: any;
        $nin: any;
        $like: any;
        $ilike: any;
        $re: any;
        $contains: any;
        $gt: any;
        $gte: any;
        $lt: any;
        $lte: any;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type AdminGetOrdersParamsType = z.infer<typeof AdminGetOrdersParams>;
export declare const AdminPostOrderExchangesReqSchema: z.ZodObject<{
    order_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostOrderExchangesReqSchemaType = z.infer<typeof AdminPostOrderExchangesReqSchema>;
export declare const AdminPostReceiveExchangesReqSchema: z.ZodObject<{
    internal_note: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostReceiveExchangesReqSchemaType = z.infer<typeof AdminPostReceiveExchangesReqSchema>;
export declare const AdminPostReceiveExchangeItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        internal_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostReceiveExchangeItemsReqSchemaType = z.infer<typeof AdminPostReceiveExchangeItemsReqSchema>;
export declare const AdminPostCancelExchangeReqSchema: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminPostCancelExchangeReqSchemaType = z.infer<typeof AdminPostCancelExchangeReqSchema>;
export declare const AdminPostExchangesRequestItemsReturnActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    reason_id: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostExchangesRequestItemsReturnActionReqSchemaType = z.infer<typeof AdminPostExchangesRequestItemsReturnActionReqSchema>;
export declare const AdminPostExchangesShippingReqSchema: z.ZodObject<{
    shipping_option_id: z.ZodString;
    custom_amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AdminPostExchangesShippingReqSchemaType = z.infer<typeof AdminPostExchangesShippingReqSchema>;
export declare const AdminPostExchangesShippingActionReqSchema: z.ZodObject<{
    custom_amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostExchangesShippingActionReqSchemaType = z.infer<typeof AdminPostExchangesShippingActionReqSchema>;
export declare const AdminPostExchangesAddItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        variant_id: z.ZodString;
        quantity: z.ZodNumber;
        unit_price: z.ZodOptional<z.ZodNumber>;
        internal_note: z.ZodOptional<z.ZodString>;
        allow_backorder: z.ZodOptional<z.ZodBoolean>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostExchangesAddItemsReqSchemaType = z.infer<typeof AdminPostExchangesAddItemsReqSchema>;
export declare const AdminPostExchangesReturnRequestItemsReqSchema: z.ZodObject<{
    location_id: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        internal_note: z.ZodOptional<z.ZodString>;
        reason_id: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostExchangesReturnRequestItemsReqSchemaType = z.infer<typeof AdminPostExchangesReturnRequestItemsReqSchema>;
export declare const AdminPostExchangesDismissItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostExchangesDismissItemsActionReqSchemaType = z.infer<typeof AdminPostExchangesDismissItemsActionReqSchema>;
export declare const AdminPostExchangesConfirmRequestReqSchema: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminPostExchangesConfirmRequestReqSchemaType = z.infer<typeof AdminPostExchangesConfirmRequestReqSchema>;
export declare const AdminPostExchangesItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostExchangesItemsActionReqSchemaType = z.infer<typeof AdminPostExchangesItemsActionReqSchema>;
export declare const AdminDeleteExchangeItemActionSchema: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminDeleteExchangeItemActionSchemaType = z.infer<typeof AdminDeleteExchangeItemActionSchema>;
//# sourceMappingURL=validators.d.ts.map