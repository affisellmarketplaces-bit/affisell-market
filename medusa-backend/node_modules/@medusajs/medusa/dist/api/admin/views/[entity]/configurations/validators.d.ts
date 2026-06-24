import { z } from "@medusajs/framework/zod";
export declare const AdminGetViewConfigurationParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetActiveViewConfigurationParamsType = z.infer<typeof AdminGetActiveViewConfigurationParams>;
export declare const AdminGetActiveViewConfigurationParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetViewConfigurationsParamsFields: z.ZodObject<{
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    entity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    user_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodNull]>>;
    is_system_default: z.ZodOptional<z.ZodBoolean>;
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
}, z.core.$strip>;
export type AdminGetViewConfigurationsParamsType = z.infer<typeof AdminGetViewConfigurationsParams>;
export declare const AdminGetViewConfigurationsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        entity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        user_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodNull]>>;
        is_system_default: z.ZodOptional<z.ZodBoolean>;
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
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        entity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        user_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodNull]>>;
        is_system_default: z.ZodOptional<z.ZodBoolean>;
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
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type AdminCreateViewConfigurationType = z.infer<typeof AdminCreateViewConfiguration>;
export declare const AdminCreateViewConfiguration: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    is_system_default: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    set_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    configuration: z.ZodObject<{
        visible_columns: z.ZodArray<z.ZodString>;
        column_order: z.ZodArray<z.ZodString>;
        column_widths: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        sorting: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            desc: z.ZodBoolean;
        }, z.core.$strip>>>;
        search: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type AdminUpdateViewConfigurationType = z.infer<typeof AdminUpdateViewConfiguration>;
export declare const AdminUpdateViewConfiguration: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    is_system_default: z.ZodOptional<z.ZodBoolean>;
    set_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    configuration: z.ZodOptional<z.ZodObject<{
        visible_columns: z.ZodOptional<z.ZodArray<z.ZodString>>;
        column_order: z.ZodOptional<z.ZodArray<z.ZodString>>;
        column_widths: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        sorting: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            desc: z.ZodBoolean;
        }, z.core.$strip>>>;
        search: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminSetActiveViewConfigurationType = z.infer<typeof AdminSetActiveViewConfiguration>;
export declare const AdminSetActiveViewConfiguration: z.ZodObject<{
    view_configuration_id: z.ZodUnion<readonly [z.ZodString, z.ZodNull]>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map