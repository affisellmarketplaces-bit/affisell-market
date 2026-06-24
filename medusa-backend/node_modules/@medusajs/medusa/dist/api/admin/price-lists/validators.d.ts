import { PriceListStatus, PriceListType } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
export declare const AdminGetPriceListPriceParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetPriceListPricesParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const AdminGetPriceListsParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    starts_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    ends_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    status: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof PriceListStatus>>>;
    rules_count: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
}, z.core.$strip>;
export declare const AdminGetPriceListsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        starts_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        ends_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        status: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof PriceListStatus>>>;
        rules_count: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        starts_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        ends_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        status: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof PriceListStatus>>>;
        rules_count: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export declare const AdminGetPriceListParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminCreatePriceListPrice: z.ZodObject<{
    currency_code: z.ZodString;
    amount: z.ZodNumber;
    variant_id: z.ZodString;
    min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type AdminCreatePriceListPriceType = z.infer<typeof AdminCreatePriceListPrice>;
export declare const AdminUpdatePriceListPrice: z.ZodObject<{
    id: z.ZodString;
    currency_code: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    variant_id: z.ZodString;
    min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type AdminUpdatePriceListPriceType = z.infer<typeof AdminUpdatePriceListPrice>;
export declare const AdminCreatePriceList: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    starts_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ends_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<typeof PriceListStatus>>;
    type: z.ZodOptional<z.ZodEnum<typeof PriceListType>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    prices: z.ZodOptional<z.ZodArray<z.ZodObject<{
        currency_code: z.ZodString;
        amount: z.ZodNumber;
        variant_id: z.ZodString;
        min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminCreatePriceListType = z.infer<typeof AdminCreatePriceList>;
export declare const AdminUpdatePriceList: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    starts_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ends_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<typeof PriceListStatus>>;
    type: z.ZodOptional<z.ZodEnum<typeof PriceListType>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type AdminUpdatePriceListType = z.infer<typeof AdminUpdatePriceList>;
export declare const AdminRemoveProductsPriceList: z.ZodObject<{
    remove: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type AdminRemoveProductsPriceListType = z.infer<typeof AdminRemoveProductsPriceList>;
//# sourceMappingURL=validators.d.ts.map