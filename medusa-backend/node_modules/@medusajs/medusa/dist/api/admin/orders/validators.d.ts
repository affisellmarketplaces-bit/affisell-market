import { z } from "@medusajs/framework/zod";
export declare const AdminGetOrdersOrderParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    version: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type AdminGetOrdersOrderParamsType = z.infer<typeof AdminGetOrdersOrderParams>;
export declare const AdminGetOrdersOrderItemsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    item_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    version: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type AdminGetOrdersOrderItemsParamsType = z.infer<typeof AdminGetOrdersOrderItemsParams>;
export declare const AdminGetOrderShippingOptionList: z.ZodObject<{}, z.core.$strip>;
export type AdminGetOrderShippingOptionListType = z.infer<typeof AdminGetOrderShippingOptionList>;
export declare const AdminGetOrdersParams: z.ZodPipe<z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>]>>;
    status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>]>>;
    sales_channel_id: z.ZodOptional<z.ZodArray<z.ZodString>>;
    region_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    customer_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    q: z.ZodOptional<z.ZodString>;
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
    total: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
}, z.core.$strip>, z.ZodTransform<{
    summary?: {
        totals: {
            current_order_total: any;
        };
    } | undefined;
    offset: number;
    limit: number;
    order: string | undefined;
    fields?: string | undefined;
    with_deleted?: boolean | undefined;
    id?: any;
    status?: any;
    sales_channel_id?: string[] | undefined;
    region_id?: string | string[] | undefined;
    customer_id?: string | string[] | undefined;
    q?: string | undefined;
    created_at?: any;
    updated_at?: any;
}, {
    offset: number;
    limit: number;
    order: string | undefined;
    fields?: string | undefined;
    with_deleted?: boolean | undefined;
    id?: any;
    status?: any;
    sales_channel_id?: string[] | undefined;
    region_id?: string | string[] | undefined;
    customer_id?: string | string[] | undefined;
    q?: string | undefined;
    created_at?: any;
    updated_at?: any;
    total?: any;
}>>;
export type AdminGetOrdersParamsType = z.infer<typeof AdminGetOrdersParams>;
export declare const AdminCompleteOrder: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminOrderCreateFulfillmentType = z.infer<typeof OrderCreateFulfillment>;
export declare const OrderCreateFulfillment: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
    }, z.core.$strip>>;
    location_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    shipping_option_id: z.ZodOptional<z.ZodString>;
    no_notification: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const AdminOrderCreateFulfillment: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminOrderCreateShipmentType = z.infer<typeof OrderCreateShipment>;
export declare const OrderCreateShipment: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        quantity: z.ZodNumber;
    }, z.core.$strip>>;
    labels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        tracking_number: z.ZodString;
        tracking_url: z.ZodString;
        label_url: z.ZodString;
    }, z.core.$strip>>>;
    no_notification: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const AdminOrderCreateShipment: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export declare const AdminMarkOrderFulfillmentAsDelivered: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminOrderCancelFulfillmentType = z.infer<typeof OrderCancelFulfillment>;
export declare const OrderCancelFulfillment: z.ZodObject<{
    no_notification: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const AdminOrderCancelFulfillment: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export declare const AdminOrderChangesParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    status: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    change_type: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
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
export type AdminOrderChangesType = z.infer<typeof AdminOrderChangesParams>;
export type AdminTransferOrderType = z.infer<typeof AdminTransferOrder>;
export declare const AdminTransferOrder: z.ZodObject<{
    customer_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    update_order_email: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminUpdateOrderType = z.infer<typeof AdminUpdateOrder>;
export declare const AdminUpdateOrder: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    shipping_address: z.ZodOptional<z.ZodObject<{
        first_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        last_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        company: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        address_1: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        address_2: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        province: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        postal_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strict>>;
    billing_address: z.ZodOptional<z.ZodObject<{
        first_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        last_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        company: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        address_1: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        address_2: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        province: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        postal_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strict>>;
    locale: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminCreateOrderCreditLinesType = z.infer<typeof AdminCreateOrderCreditLines>;
export declare const AdminCreateOrderCreditLines: z.ZodObject<{
    amount: z.ZodNumber;
    reference: z.ZodString;
    reference_id: z.ZodString;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map