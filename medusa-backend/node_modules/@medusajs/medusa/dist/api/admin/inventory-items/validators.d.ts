import { z } from "@medusajs/framework/zod";
export type AdminGetInventoryItemParamsType = z.infer<typeof AdminGetInventoryItemParams>;
export declare const AdminGetInventoryItemParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetInventoryItemsParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    origin_country: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    mid_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    hs_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    material: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    requires_shipping: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    weight: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    length: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    height: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    width: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    location_levels: z.ZodOptional<z.ZodObject<{
        location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AdminGetInventoryItemsParamsType = z.infer<typeof AdminGetInventoryItemsParams>;
export declare const AdminGetInventoryItemsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        origin_country: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        mid_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        hs_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        material: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        requires_shipping: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        weight: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        length: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        height: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        width: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        location_levels: z.ZodOptional<z.ZodObject<{
            location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        origin_country: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        mid_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        hs_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        material: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        requires_shipping: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        weight: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        length: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        height: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        width: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
        location_levels: z.ZodOptional<z.ZodObject<{
            location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>>;
}, z.core.$strict>;
export type AdminGetInventoryLocationLevelParamsType = z.infer<typeof AdminGetInventoryLocationLevelParams>;
export declare const AdminGetInventoryLocationLevelParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetInventoryLocationLevelsParamsFields: z.ZodObject<{
    location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type AdminGetInventoryLocationLevelsParamsType = z.infer<typeof AdminGetInventoryLocationLevelsParams>;
export declare const AdminGetInventoryLocationLevelsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type AdminCreateInventoryLocationLevelType = z.infer<typeof AdminCreateInventoryLocationLevel>;
export declare const AdminCreateInventoryLocationLevel: z.ZodObject<{
    location_id: z.ZodString;
    stocked_quantity: z.ZodOptional<z.ZodNumber>;
    incoming_quantity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type AdminUpdateInventoryLocationLevelBatchType = z.infer<typeof AdminUpdateInventoryLocationLevelBatch>;
export declare const AdminUpdateInventoryLocationLevelBatch: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    location_id: z.ZodString;
    stocked_quantity: z.ZodOptional<z.ZodNumber>;
    incoming_quantity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type AdminBatchInventoryItemLocationsLevelType = z.infer<typeof AdminBatchInventoryItemLocationsLevel>;
export declare const AdminBatchInventoryItemLocationsLevel: z.ZodObject<{
    create: z.ZodOptional<z.ZodArray<z.ZodObject<{
        location_id: z.ZodString;
        stocked_quantity: z.ZodOptional<z.ZodNumber>;
        incoming_quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>;
    update: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        location_id: z.ZodString;
        stocked_quantity: z.ZodOptional<z.ZodNumber>;
        incoming_quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>;
    delete: z.ZodOptional<z.ZodArray<z.ZodString>>;
    force: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AdminUpdateInventoryLocationLevelType = z.infer<typeof AdminUpdateInventoryLocationLevel>;
export declare const AdminUpdateInventoryLocationLevel: z.ZodObject<{
    stocked_quantity: z.ZodOptional<z.ZodNumber>;
    incoming_quantity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type AdminCreateInventoryItemType = z.infer<typeof AdminCreateInventoryItem>;
export declare const AdminCreateInventoryItem: z.ZodObject<{
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requires_shipping: z.ZodOptional<z.ZodBoolean>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    location_levels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        location_id: z.ZodString;
        stocked_quantity: z.ZodOptional<z.ZodNumber>;
        incoming_quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type AdminUpdateInventoryItemType = z.infer<typeof AdminUpdateInventoryItem>;
export declare const AdminUpdateInventoryItem: z.ZodObject<{
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requires_shipping: z.ZodOptional<z.ZodBoolean>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strict>;
export declare const AdminBatchInventoryItemLevels: z.ZodObject<{
    create: z.ZodOptional<z.ZodArray<z.ZodObject<{
        inventory_item_id: z.ZodString;
        location_id: z.ZodString;
        stocked_quantity: z.ZodOptional<z.ZodNumber>;
        incoming_quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    update: z.ZodOptional<z.ZodArray<z.ZodObject<{
        inventory_item_id: z.ZodString;
        location_id: z.ZodString;
        stocked_quantity: z.ZodOptional<z.ZodNumber>;
        incoming_quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    delete: z.ZodOptional<z.ZodArray<z.ZodString>>;
    force: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export type AdminBatchInventoryItemLevelsType = z.infer<typeof AdminBatchInventoryItemLevels>;
//# sourceMappingURL=validators.d.ts.map