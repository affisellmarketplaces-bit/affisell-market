import { z } from "@medusajs/framework/zod";
export type AdminGetDraftOrderParamsType = z.infer<typeof AdminGetDraftOrderParams>;
export declare const AdminGetDraftOrderParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetDraftOrdersParamsType = z.infer<typeof AdminGetDraftOrdersParams>;
export declare const AdminGetDraftOrdersParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
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
        q: z.ZodOptional<z.ZodString>;
        region_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        sales_channel_id: z.ZodOptional<z.ZodArray<z.ZodString>>;
        customer_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
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
        q: z.ZodOptional<z.ZodString>;
        region_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        sales_channel_id: z.ZodOptional<z.ZodArray<z.ZodString>>;
        customer_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
declare enum Status {
    completed = "completed"
}
export type AdminCreateDraftOrderType = z.infer<typeof CreateDraftOrder>;
declare const CreateDraftOrder: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<typeof Status>>;
    sales_channel_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customer_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    billing_address: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
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
    }, z.core.$strict>, z.ZodString]>>;
    shipping_address: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
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
    }, z.core.$strict>, z.ZodString]>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        variant_sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        variant_barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        variant_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        unit_price: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodObject<{
            value: z.ZodString;
            precision: z.ZodNumber;
        }, z.core.$strip>]>>>;
        quantity: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>>;
    region_id: z.ZodString;
    promo_codes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    no_notification_order: z.ZodOptional<z.ZodBoolean>;
    shipping_methods: z.ZodOptional<z.ZodArray<z.ZodObject<{
        shipping_method_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        name: z.ZodString;
        shipping_option_id: z.ZodString;
        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodObject<{
            value: z.ZodString;
            precision: z.ZodNumber;
        }, z.core.$strip>]>;
    }, z.core.$strip>>>;
    locale: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strict>;
export declare const AdminCreateDraftOrder: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminUpdateDraftOrderType = z.infer<typeof AdminUpdateDraftOrder>;
export declare const AdminUpdateDraftOrder: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    customer_id: z.ZodOptional<z.ZodString>;
    sales_channel_id: z.ZodOptional<z.ZodString>;
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
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    locale: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminAddDraftOrderPromotionsType = z.infer<typeof AdminAddDraftOrderPromotions>;
export declare const AdminAddDraftOrderPromotions: z.ZodObject<{
    promo_codes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AdminRemoveDraftOrderPromotionsType = z.infer<typeof AdminRemoveDraftOrderPromotions>;
export declare const AdminRemoveDraftOrderPromotions: z.ZodObject<{
    promo_codes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AdminUpdateDraftOrderItemType = z.infer<typeof AdminUpdateDraftOrderItem>;
export declare const AdminUpdateDraftOrderItem: z.ZodObject<{
    quantity: z.ZodNumber;
    unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    compare_at_unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminUpdateDraftOrderActionItemType = z.infer<typeof AdminUpdateDraftOrderActionItem>;
export declare const AdminUpdateDraftOrderActionItem: z.ZodObject<{
    quantity: z.ZodNumber;
    unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    compare_at_unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    internal_note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminAddDraftOrderItems: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        variant_id: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        compare_at_unit_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        internal_note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        allow_backorder: z.ZodOptional<z.ZodBoolean>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminAddDraftOrderItemsType = z.infer<typeof AdminAddDraftOrderItems>;
export declare const AdminAddDraftOrderShippingMethod: z.ZodObject<{
    shipping_option_id: z.ZodString;
    custom_amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    internal_note: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AdminAddDraftOrderShippingMethodType = z.infer<typeof AdminAddDraftOrderShippingMethod>;
export declare const AdminUpdateDraftOrderActionShippingMethod: z.ZodObject<{
    shipping_option_id: z.ZodString;
    custom_amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    internal_note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminUpdateDraftOrderActionShippingMethodType = z.infer<typeof AdminUpdateDraftOrderActionShippingMethod>;
export declare const AdminUpdateDraftOrderShippingMethod: z.ZodObject<{
    shipping_option_id: z.ZodOptional<z.ZodString>;
    custom_amount: z.ZodOptional<z.ZodNumber>;
    internal_note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type AdminUpdateDraftOrderShippingMethodType = z.infer<typeof AdminUpdateDraftOrderShippingMethod>;
export {};
//# sourceMappingURL=validators.d.ts.map