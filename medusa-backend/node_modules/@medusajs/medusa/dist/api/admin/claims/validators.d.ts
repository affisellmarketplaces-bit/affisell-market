import { ClaimReason, ClaimType } from "@medusajs/framework/utils";
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
export declare const AdminPostOrderClaimsReqSchema: z.ZodObject<{
    type: z.ZodEnum<typeof ClaimType>;
    order_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    reason_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostOrderClaimsReqSchemaType = z.infer<typeof AdminPostOrderClaimsReqSchema>;
export declare const AdminPostOrderExchangesReqSchema: z.ZodObject<{
    order_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostOrderExchangesReqSchemaType = z.infer<typeof AdminPostOrderExchangesReqSchema>;
export declare const AdminPostReceiveClaimsReqSchema: z.ZodObject<{
    internal_note: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminPostReceiveClaimsReqSchemaType = z.infer<typeof AdminPostReceiveClaimsReqSchema>;
export declare const AdminPostReceiveClaimItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        internal_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostReceiveClaimItemsReqSchemaType = z.infer<typeof AdminPostReceiveClaimItemsReqSchema>;
export declare const AdminPostCancelClaimReqSchema: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminPostCancelClaimReqSchemaType = z.infer<typeof AdminPostCancelClaimReqSchema>;
export declare const AdminPostClaimsShippingReqSchema: z.ZodObject<{
    shipping_option_id: z.ZodString;
    custom_amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AdminPostClaimsShippingReqSchemaType = z.infer<typeof AdminPostClaimsShippingReqSchema>;
export declare const AdminPostClaimsShippingActionReqSchema: z.ZodObject<{
    custom_amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostClaimsShippingActionReqSchemaType = z.infer<typeof AdminPostClaimsShippingActionReqSchema>;
export declare const AdminPostClaimsAddItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        variant_id: z.ZodString;
        quantity: z.ZodNumber;
        unit_price: z.ZodOptional<z.ZodNumber>;
        internal_note: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostClaimsAddItemsReqSchemaType = z.infer<typeof AdminPostClaimsAddItemsReqSchema>;
export declare const AdminPostClaimsRequestReturnItemsReqSchema: z.ZodObject<{
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
export type AdminPostClaimsRequestReturnItemsReqSchemaType = z.infer<typeof AdminPostClaimsRequestReturnItemsReqSchema>;
export declare const AdminPostClaimsRequestItemsReturnActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    reason_id: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostClaimsRequestItemsReturnActionReqSchemaType = z.infer<typeof AdminPostClaimsRequestItemsReturnActionReqSchema>;
export declare const AdminPostClaimItemsReqSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
        reason: z.ZodOptional<z.ZodEnum<typeof ClaimReason>>;
        description: z.ZodOptional<z.ZodString>;
        internal_note: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminPostClaimItemsReqSchemaType = z.infer<typeof AdminPostClaimItemsReqSchema>;
export declare const AdminPostClaimsRequestItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    reason_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
}, z.core.$strip>;
export type AdminPostClaimsRequestItemsActionReqSchemaType = z.infer<typeof AdminPostClaimsRequestItemsActionReqSchema>;
export declare const AdminPostClaimsItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    reason_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostClaimsItemsActionReqSchemaType = z.infer<typeof AdminPostClaimsItemsActionReqSchema>;
export declare const AdminPostClaimsDismissItemsActionReqSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type AdminPostClaimsDismissItemsActionReqSchemaType = z.infer<typeof AdminPostClaimsDismissItemsActionReqSchema>;
export declare const AdminPostClaimsConfirmRequestReqSchema: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminPostClaimsConfirmRequestReqSchemaType = z.infer<typeof AdminPostClaimsConfirmRequestReqSchema>;
export declare const AdminDeleteClaimItemActionSchema: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminDeleteClaimItemActionSchemaType = z.infer<typeof AdminDeleteClaimItemActionSchema>;
//# sourceMappingURL=validators.d.ts.map