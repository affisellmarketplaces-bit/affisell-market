import { z } from "@medusajs/framework/zod";
export declare const AdminFulfillmentParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminCreateFulfillmentType = z.infer<typeof AdminCreateFulfillment>;
export declare const AdminCreateFulfillment: z.ZodObject<{
    location_id: z.ZodString;
    provider_id: z.ZodString;
    delivery_address: z.ZodObject<{
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
    }, z.core.$strict>;
    items: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        sku: z.ZodString;
        quantity: z.ZodNumber;
        barcode: z.ZodString;
        line_item_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        inventory_item_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    labels: z.ZodArray<z.ZodObject<{
        tracking_number: z.ZodString;
        tracking_url: z.ZodString;
        label_url: z.ZodString;
    }, z.core.$strip>>;
    order_id: z.ZodString;
    shipping_option_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    data: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    packed_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    shipped_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    delivered_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    canceled_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AdminCreateShipmentType = z.infer<typeof AdminCreateShipment>;
export declare const AdminCreateShipment: z.ZodObject<{
    labels: z.ZodArray<z.ZodObject<{
        tracking_number: z.ZodString;
        tracking_url: z.ZodString;
        label_url: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map