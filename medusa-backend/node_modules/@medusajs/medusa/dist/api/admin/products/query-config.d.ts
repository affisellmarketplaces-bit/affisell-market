/**
 * Product-related entity names for query configuration.
 */
export declare enum Entities {
    product = "product",
    product_option = "product_option",
    product_variant = "product_variant",
    inventory_item = "inventory_item",
    price = "price"
}
/**
 * Default fields for admin product variants, excluding the product relation.
 */
export declare const defaultAdminProductsVariantFields: string[];
/**
 * Query configuration for retrieving a single product variant.
 */
export declare const retrieveVariantConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
/**
 * Query configuration for listing product variants.
 */
export declare const listVariantConfig: {
    defaultLimit: number;
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
/**
 * Default fields for admin product options.
 */
export declare const defaultAdminProductsOptionFields: string[];
/**
 * Query configuration for retrieving a single product option.
 */
export declare const retrieveOptionConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
/**
 * Query configuration for listing product options.
 */
export declare const listOptionConfig: {
    defaultLimit: number;
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
/**
 * Default fields for admin products, including relations and nested fields.
 */
export declare const defaultAdminProductFields: string[];
/**
 * Query configuration for retrieving a single product.
 */
export declare const retrieveProductQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
/**
 * Query configuration for listing products.
 */
export declare const listProductQueryConfig: {
    defaultLimit: number;
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
//# sourceMappingURL=query-config.d.ts.map