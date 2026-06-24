"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductQueryConfig = exports.retrieveProductQueryConfig = exports.defaultAdminProductFields = exports.listOptionConfig = exports.retrieveOptionConfig = exports.defaultAdminProductsOptionFields = exports.listVariantConfig = exports.retrieveVariantConfig = exports.defaultAdminProductsVariantFields = exports.Entities = void 0;
const query_config_1 = require("../product-variants/query-config");
/**
 * Product-related entity names for query configuration.
 */
var Entities;
(function (Entities) {
    Entities["product"] = "product";
    Entities["product_option"] = "product_option";
    Entities["product_variant"] = "product_variant";
    Entities["inventory_item"] = "inventory_item";
    Entities["price"] = "price";
})(Entities || (exports.Entities = Entities = {}));
/**
 * Default fields for admin product variants, excluding the product relation.
 */
exports.defaultAdminProductsVariantFields = query_config_1.defaultAdminProductVariantFields.filter((field) => field !== "*product");
/**
 * Query configuration for retrieving a single product variant.
 */
exports.retrieveVariantConfig = {
    defaults: exports.defaultAdminProductsVariantFields,
    isList: false,
    entity: Entities.product_variant,
};
/**
 * Query configuration for listing product variants.
 */
exports.listVariantConfig = {
    ...exports.retrieveVariantConfig,
    defaultLimit: 50,
    isList: true,
    entity: Entities.product_variant,
};
/**
 * Default fields for admin product options.
 */
exports.defaultAdminProductsOptionFields = ["id", "title"];
/**
 * Query configuration for retrieving a single product option.
 */
exports.retrieveOptionConfig = {
    defaults: exports.defaultAdminProductsOptionFields,
    isList: false,
    entity: Entities.product_option,
};
/**
 * Query configuration for listing product options.
 */
exports.listOptionConfig = {
    ...exports.retrieveOptionConfig,
    defaultLimit: 50,
    isList: true,
    entity: Entities.product_option,
};
/**
 * Default fields for admin products, including relations and nested fields.
 */
exports.defaultAdminProductFields = [
    "id",
    "title",
    "subtitle",
    "status",
    "external_id",
    "description",
    "handle",
    "is_giftcard",
    "discountable",
    "thumbnail",
    "collection_id",
    "type_id",
    "weight",
    "length",
    "height",
    "width",
    "hs_code",
    "origin_country",
    "mid_code",
    "material",
    "created_at",
    "updated_at",
    "deleted_at",
    "metadata",
    "*type",
    "*collection",
    "*options",
    "*options.values",
    "*tags",
    "*images",
    "*variants",
    "*variants.prices",
    "variants.prices.price_rules.value",
    "variants.prices.price_rules.attribute",
    "*variants.options",
    "*variants.images",
    "*sales_channels",
];
/**
 * Query configuration for retrieving a single product.
 */
exports.retrieveProductQueryConfig = {
    defaults: exports.defaultAdminProductFields,
    isList: false,
    entity: Entities.product,
};
/**
 * Query configuration for listing products.
 */
exports.listProductQueryConfig = {
    ...exports.retrieveProductQueryConfig,
    defaultLimit: 50,
    isList: true,
    entity: Entities.product,
};
//# sourceMappingURL=query-config.js.map