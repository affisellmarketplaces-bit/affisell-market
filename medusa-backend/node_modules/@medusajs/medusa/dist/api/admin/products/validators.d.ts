import { BatchMethodRequest } from "@medusajs/framework/types";
import { ProductStatus } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
export declare const AdminGetProductParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetProductVariantParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetProductOptionParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetProductsParamsDirectFields: z.ZodObject<{
    variants: z.ZodOptional<z.ZodObject<{
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
            sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            barcode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
            ean: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            upc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
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
            sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            barcode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
            ean: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            upc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        }, z.core.$strip>>>>;
    }, z.core.$strip>>;
    status: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof ProductStatus>>>;
}, z.core.$strip>;
export type AdminGetProductsParamsType = z.infer<typeof AdminGetProductsParams>;
export declare const AdminGetProductsParams: z.ZodPipe<z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        variants: z.ZodOptional<z.ZodObject<{
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
                sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                barcode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
                ean: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                upc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
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
                sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                barcode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
                ean: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                upc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
            }, z.core.$strip>>>>;
        }, z.core.$strip>>;
        status: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof ProductStatus>>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        variants: z.ZodOptional<z.ZodObject<{
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
                sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                barcode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
                ean: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                upc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
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
                sku: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                barcode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
                ean: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                upc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
                manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
            }, z.core.$strip>>>>;
        }, z.core.$strip>>;
        status: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof ProductStatus>>>;
    }, z.core.$strip>>>>;
    sales_channel_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    handle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    is_giftcard: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    category_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    external_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    collection_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    tag_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    type_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
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
}, z.core.$strip>, z.ZodTransform<unknown, Record<string, unknown>>>;
export declare const AdminGetProductOptionsParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    title: z.ZodOptional<z.ZodString>;
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
export type AdminGetProductOptionsParamsType = z.infer<typeof AdminGetProductOptionsParams>;
export declare const AdminGetProductOptionsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        title: z.ZodOptional<z.ZodString>;
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
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        title: z.ZodOptional<z.ZodString>;
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
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type AdminCreateProductOptionType = z.infer<typeof CreateProductOption>;
export declare const CreateProductOption: z.ZodObject<{
    title: z.ZodString;
    values: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const AdminCreateProductOption: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminUpdateProductOptionType = z.infer<typeof UpdateProductOption>;
export declare const UpdateProductOption: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    values: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const AdminUpdateProductOption: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminCreateVariantPriceType = z.infer<typeof AdminCreateVariantPrice>;
export declare const AdminCreateVariantPrice: z.ZodObject<{
    currency_code: z.ZodString;
    amount: z.ZodNumber;
    min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type AdminUpdateVariantPriceType = z.infer<typeof AdminUpdateVariantPrice>;
export declare const AdminUpdateVariantPrice: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    currency_code: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type AdminCreateProductVariantType = z.infer<typeof CreateProductVariant>;
export declare const CreateProductVariant: z.ZodObject<{
    title: z.ZodString;
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ean: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    upc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    allow_backorder: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>>;
    manage_inventory: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>>;
    variant_rank: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    prices: z.ZodArray<z.ZodObject<{
        currency_code: z.ZodString;
        amount: z.ZodNumber;
        min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    inventory_items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        inventory_item_id: z.ZodString;
        required_quantity: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strict>;
export declare const AdminCreateProductVariant: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminUpdateProductVariantType = z.infer<typeof UpdateProductVariant>;
export declare const UpdateProductVariant: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    prices: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        currency_code: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>>;
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ean: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    upc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    variant_rank: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strict>;
export declare const AdminUpdateProductVariant: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminBatchUpdateProductVariantType = z.infer<typeof AdminBatchUpdateProductVariant>;
export declare const AdminBatchUpdateProductVariant: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    prices: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        currency_code: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>>;
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ean: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    upc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    variant_rank: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    id: z.ZodString;
}, z.core.$strict>;
export declare const IdAssociation: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type AdminCreateProductType = z.infer<typeof CreateProduct>;
export declare const CreateProduct: z.ZodObject<{
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_giftcard: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>>;
    discountable: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>>;
    images: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, z.core.$strip>>>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    handle: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodEnum<typeof ProductStatus>>>>;
    external_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    collection_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    categories: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        values: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    variants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ean: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        upc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        allow_backorder: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>>;
        manage_inventory: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>>;
        variant_rank: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        prices: z.ZodArray<z.ZodObject<{
            currency_code: z.ZodString;
            amount: z.ZodNumber;
            min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        inventory_items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            inventory_item_id: z.ZodString;
            required_quantity: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strict>>>;
    sales_channels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    shipping_profile_id: z.ZodOptional<z.ZodString>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strict>;
export declare const AdminCreateProduct: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminUpdateProductType = z.infer<typeof UpdateProduct>;
export declare const UpdateProduct: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    discountable: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    is_giftcard: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    variants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        prices: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            currency_code: z.ZodOptional<z.ZodString>;
            amount: z.ZodOptional<z.ZodNumber>;
            min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>>;
        sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ean: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        upc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        variant_rank: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strict>>>;
    status: z.ZodOptional<z.ZodEnum<typeof ProductStatus>>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    images: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
    }, z.core.$strip>>>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    handle: z.ZodOptional<z.ZodString>;
    type_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    external_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    collection_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    categories: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    sales_channels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    shipping_profile_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strict>;
export declare const AdminUpdateProduct: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminBatchUpdateProductType = z.infer<typeof AdminBatchUpdateProduct>;
export declare const AdminBatchUpdateProduct: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    discountable: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    is_giftcard: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    variants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        prices: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            currency_code: z.ZodOptional<z.ZodString>;
            amount: z.ZodOptional<z.ZodNumber>;
            min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>>;
        sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ean: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        upc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        variant_rank: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strict>>>;
    status: z.ZodOptional<z.ZodEnum<typeof ProductStatus>>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    images: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
    }, z.core.$strip>>>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    handle: z.ZodOptional<z.ZodString>;
    type_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    external_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    collection_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    categories: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    sales_channels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>>;
    shipping_profile_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    id: z.ZodString;
}, z.core.$strict>;
export declare const AdminCreateVariantInventoryItem: z.ZodObject<{
    required_quantity: z.ZodNumber;
    inventory_item_id: z.ZodString;
}, z.core.$strip>;
export type AdminCreateVariantInventoryItemType = z.infer<typeof AdminCreateVariantInventoryItem>;
export declare const AdminUpdateVariantInventoryItem: z.ZodObject<{
    required_quantity: z.ZodNumber;
}, z.core.$strip>;
export type AdminUpdateVariantInventoryItemType = z.infer<typeof AdminUpdateVariantInventoryItem>;
export declare const AdminBatchCreateVariantInventoryItem: z.ZodObject<{
    required_quantity: z.ZodNumber;
    inventory_item_id: z.ZodString;
    variant_id: z.ZodString;
}, z.core.$strict>;
export type AdminBatchCreateVariantInventoryItemType = z.infer<typeof AdminBatchCreateVariantInventoryItem>;
export declare const AdminBatchUpdateVariantInventoryItem: z.ZodObject<{
    required_quantity: z.ZodNumber;
    inventory_item_id: z.ZodString;
    variant_id: z.ZodString;
}, z.core.$strict>;
export type AdminBatchUpdateVariantInventoryItemType = z.infer<typeof AdminBatchUpdateVariantInventoryItem>;
export declare const AdminBatchDeleteVariantInventoryItem: z.ZodObject<{
    inventory_item_id: z.ZodString;
    variant_id: z.ZodString;
}, z.core.$strict>;
export type AdminBatchDeleteVariantInventoryItemType = z.infer<typeof AdminBatchDeleteVariantInventoryItem>;
export type AdminBatchVariantInventoryItemsType = BatchMethodRequest<AdminBatchCreateVariantInventoryItemType, AdminBatchUpdateVariantInventoryItemType, AdminBatchDeleteVariantInventoryItemType>;
export declare const AdminBatchImageVariant: z.ZodObject<{
    add: z.ZodOptional<z.ZodArray<z.ZodString>>;
    remove: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type AdminBatchImageVariantType = z.infer<typeof AdminBatchImageVariant>;
export declare const AdminBatchVariantImages: z.ZodObject<{
    add: z.ZodOptional<z.ZodArray<z.ZodString>>;
    remove: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type AdminBatchVariantImagesType = z.infer<typeof AdminBatchVariantImages>;
export declare const AdminImportProducts: z.ZodObject<{
    file_key: z.ZodString;
    originalname: z.ZodString;
    extension: z.ZodString;
    size: z.ZodNumber;
    mime_type: z.ZodString;
}, z.core.$strip>;
export type AdminImportProductsType = z.infer<typeof AdminImportProducts>;
//# sourceMappingURL=validators.d.ts.map