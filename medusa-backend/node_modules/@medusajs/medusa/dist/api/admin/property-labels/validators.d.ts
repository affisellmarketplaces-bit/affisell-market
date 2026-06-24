import { z } from "zod";
/**
 * Query parameters for listing property labels.
 */
export declare const AdminPropertyLabelParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Query parameters for filtering property labels.
 */
export declare const AdminPropertyLabelListParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    entity: z.ZodOptional<z.ZodString>;
    property: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    offset: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    order: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Payload for creating a property label.
 */
export declare const AdminCreatePropertyLabel: z.ZodObject<{
    entity: z.ZodString;
    property: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
/**
 * Payload for updating a property label.
 */
export declare const AdminUpdatePropertyLabel: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
/**
 * Payload for batch property label operations.
 */
export declare const AdminBatchPropertyLabels: z.ZodObject<{
    create: z.ZodOptional<z.ZodArray<z.ZodObject<{
        entity: z.ZodString;
        property: z.ZodString;
        label: z.ZodString;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    update: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    delete: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type AdminCreatePropertyLabelType = z.infer<typeof AdminCreatePropertyLabel>;
export type AdminUpdatePropertyLabelType = z.infer<typeof AdminUpdatePropertyLabel>;
export type AdminBatchPropertyLabelsType = z.infer<typeof AdminBatchPropertyLabels>;
export type AdminPropertyLabelListParamsType = z.infer<typeof AdminPropertyLabelListParams>;
//# sourceMappingURL=validators.d.ts.map