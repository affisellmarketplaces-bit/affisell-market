import { z } from "@medusajs/framework/zod";
export declare const AdminServiceZonesParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminServiceZonesParamsType = z.infer<typeof AdminServiceZonesParams>;
export declare const AdminCreateFulfillmentSetServiceZonesSchema: z.ZodObject<{
    name: z.ZodString;
    geo_zones: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"country">;
    }, z.core.$strip>, z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"province">;
        province_code: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"city">;
        province_code: z.ZodString;
        city: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"zip">;
        province_code: z.ZodString;
        city: z.ZodString;
        postal_expression: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>]>>>;
}, z.core.$strict>;
export declare const AdminUpdateFulfillmentSetServiceZonesSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    geo_zones: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"country">;
        id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"province">;
        province_code: z.ZodString;
        id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"city">;
        province_code: z.ZodString;
        city: z.ZodString;
        id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        country_code: z.ZodString;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        type: z.ZodLiteral<"zip">;
        province_code: z.ZodString;
        city: z.ZodString;
        postal_expression: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>>;
}, z.core.$strict>;
export declare const AdminFulfillmentSetParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminCreateFulfillmentSetServiceZonesType = z.infer<typeof AdminCreateFulfillmentSetServiceZonesSchema>;
export type AdminUpdateFulfillmentSetServiceZonesType = z.infer<typeof AdminUpdateFulfillmentSetServiceZonesSchema>;
export type AdminFulfillmentSetParamsType = z.infer<typeof AdminFulfillmentSetParams>;
//# sourceMappingURL=validators.d.ts.map