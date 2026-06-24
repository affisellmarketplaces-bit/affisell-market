import { z } from "@medusajs/framework/zod";
export declare const AdminGetTranslationParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    reference_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    reference: z.ZodOptional<z.ZodString>;
    locale_code: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetTranslationsParamsType = z.infer<typeof AdminGetTranslationsParams>;
export declare const AdminGetTranslationsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        reference_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        reference: z.ZodOptional<z.ZodString>;
        locale_code: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        reference_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        reference: z.ZodOptional<z.ZodString>;
        locale_code: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type AdminCreateTranslationType = z.infer<typeof AdminCreateTranslation>;
export declare const AdminCreateTranslation: z.ZodObject<{
    reference_id: z.ZodString;
    reference: z.ZodString;
    locale_code: z.ZodString;
    translations: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export type AdminUpdateTranslationType = z.infer<typeof AdminUpdateTranslation>;
export declare const AdminUpdateTranslation: z.ZodObject<{
    id: z.ZodString;
    reference_id: z.ZodOptional<z.ZodString>;
    reference: z.ZodOptional<z.ZodString>;
    locale_code: z.ZodOptional<z.ZodString>;
    translations: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type AdminBatchTranslationsType = z.infer<typeof AdminBatchTranslations>;
export declare const AdminBatchTranslations: z.ZodObject<{
    create: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    update: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    delete: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
}, z.core.$strip>;
export type AdminTranslationStatisticsType = z.infer<typeof AdminTranslationStatisticsParams>;
export declare const AdminTranslationStatisticsParams: z.ZodPipe<z.ZodObject<{
    locales: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    entity_types: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$strip>, z.ZodTransform<{
    locales: string[];
    entity_types: string[];
}, {
    locales: string | string[];
    entity_types: string | string[];
}>>;
export type AdminTranslationSettingsParamsType = z.infer<typeof AdminTranslationSettingsParams>;
export declare const AdminTranslationSettingsParams: z.ZodObject<{
    entity_type: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
}, z.core.$strip>;
export type AdminBatchTranslationSettingsType = z.infer<typeof AdminBatchTranslationSettings>;
export declare const AdminBatchTranslationSettings: z.ZodObject<{
    create: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    update: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    delete: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
}, z.core.$strip>;
export type AdminTranslationEntitiesParamsType = z.infer<typeof AdminTranslationEntitiesParams>;
export declare const AdminTranslationEntitiesParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    type: z.ZodString;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map