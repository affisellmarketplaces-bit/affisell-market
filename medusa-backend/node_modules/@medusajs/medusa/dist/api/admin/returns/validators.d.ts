import { z } from "@medusajs/framework/zod";
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
export declare const AdminGetReturnParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetReturnParamsType = z.infer<typeof AdminGetReturnParams>;
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
export declare const AdminPostReturnsReqSchema: z.ZodObject<{
    order_id: z.ZodString;
    location_id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    no_notification: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostReturnsReqSchemaType = z.infer<typeof AdminPostReturnsReqSchema>;
export declare const AdminPostReturnsReturnReqSchema: z.ZodObject<{
    location_id: z.ZodOptional<z.ZodString>;
    no_notification: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostReturnsReturnReqSchemaType = z.infer<typeof AdminPostReturnsReturnReqSchema>;
export declare const AdminPostOrderExchangesReqSchema: z.ZodObject<{
    order_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostOrderExchangesReqSchemaType = z.infer<typeof AdminPostOrderExchangesReqSchema>;
export declare const AdminPostReceiveReturnsReqSchema: z.ZodObject<{
    internal_note: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostReceiveReturnsReqSchemaType = z.infer<typeof AdminPostReceiveReturnsReqSchema>;
export declare const AdminPostReceiveReturnItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        internal_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostReceiveReturnItemsReqSchemaType = z.infer<typeof AdminPostReceiveReturnItemsReqSchema>;
export declare const AdminPostCancelReturnReqSchema: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminPostCancelReturnReqSchemaType = z.infer<typeof AdminPostCancelReturnReqSchema>;
export declare const AdminPostReturnsShippingReqSchema: z.ZodObject<{
    shipping_option_id: z.ZodString;
    custom_amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AdminPostReturnsShippingReqSchemaType = z.infer<typeof AdminPostReturnsShippingReqSchema>;
export declare const AdminPostReturnsShippingActionReqSchema: z.ZodObject<{
    custom_amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostReturnsShippingActionReqSchemaType = z.infer<typeof AdminPostReturnsShippingActionReqSchema>;
export declare const AdminPostReturnsRequestItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        internal_note: z.ZodOptional<z.ZodString>;
        reason_id: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostReturnsRequestItemsReqSchemaType = z.infer<typeof AdminPostReturnsRequestItemsReqSchema>;
export declare const AdminPostReturnsReceiveItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        internal_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostReturnsReceiveItemsReqSchemaType = z.infer<typeof AdminPostReturnsReceiveItemsReqSchema>;
export declare const AdminPostReturnsRequestItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    reason_id: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostReturnsRequestItemsActionReqSchemaType = z.infer<typeof AdminPostReturnsRequestItemsActionReqSchema>;
export declare const AdminPostReturnsReceiveItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostReturnsReceiveItemsActionReqSchemaType = z.infer<typeof AdminPostReturnsReceiveItemsActionReqSchema>;
export declare const AdminPostReturnsDismissItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostReturnsDismissItemsActionReqSchemaType = z.infer<typeof AdminPostReturnsDismissItemsActionReqSchema>;
export declare const AdminPostReturnsConfirmRequestReqSchema: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminPostReturnsConfirmRequestReqSchemaType = z.infer<typeof AdminPostReturnsConfirmRequestReqSchema>;
//# sourceMappingURL=validators.d.ts.map