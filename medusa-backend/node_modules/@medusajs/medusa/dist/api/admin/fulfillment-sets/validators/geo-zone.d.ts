import { z } from "@medusajs/framework/zod";
export declare const geoZoneCountrySchema: z.ZodObject<{
    country_code: z.ZodString;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    type: z.ZodLiteral<"country">;
}, z.core.$strip>;
export declare const geoZoneProvinceSchema: z.ZodObject<{
    country_code: z.ZodString;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    type: z.ZodLiteral<"province">;
    province_code: z.ZodString;
}, z.core.$strip>;
export declare const geoZoneCitySchema: z.ZodObject<{
    country_code: z.ZodString;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    type: z.ZodLiteral<"city">;
    province_code: z.ZodString;
    city: z.ZodString;
}, z.core.$strip>;
export declare const geoZoneZipSchema: z.ZodObject<{
    country_code: z.ZodString;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    type: z.ZodLiteral<"zip">;
    province_code: z.ZodString;
    city: z.ZodString;
    postal_expression: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
//# sourceMappingURL=geo-zone.d.ts.map