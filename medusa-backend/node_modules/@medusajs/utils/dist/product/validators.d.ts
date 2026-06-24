import { z } from "@medusajs/deps/zod";
import { ProductStatus } from "./enums";
export declare const booleanString: () => z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>;
export declare const numericString: () => z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>;
export declare const IdAssociation: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const CreateVariantPrice: z.ZodObject<{
    currency_code: z.ZodString;
    amount: z.ZodNumber;
    min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const CreateProductOption: z.ZodObject<{
    title: z.ZodString;
    values: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
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
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<typeof ProductStatus>>>;
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
export declare const UpdateProductOption: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    values: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const UpdateVariantPrice: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    currency_code: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
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
    allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    variant_rank: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strict>;
export declare const UpdateProduct: z.ZodObject<{
    id: z.ZodString;
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
        allow_backorder: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        manage_inventory: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
        variant_rank: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
        length: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
        height: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
        width: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
        origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strict>>>;
    status: z.ZodOptional<z.ZodEnum<typeof ProductStatus>>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    images: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
    }, z.core.$strip>>>;
    thumbnail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
    weight: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    height: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    width: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>>>;
    hs_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mid_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin_country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    material: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strict>;
//# sourceMappingURL=validators.d.ts.map