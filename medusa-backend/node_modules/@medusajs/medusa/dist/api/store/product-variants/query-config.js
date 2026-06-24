"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductVariantConfig = exports.retrieveProductVariantConfig = exports.defaultStoreProductVariantFields = void 0;
exports.defaultStoreProductVariantFields = [
    "id",
    "title",
    "sku",
    "barcode",
    "ean",
    "upc",
    "allow_backorder",
    "manage_inventory",
    "variant_rank",
    "product_id",
    "thumbnail",
    "hs_code",
    "origin_country",
    "mid_code",
    "material",
    "weight",
    "length",
    "height",
    "width",
    "created_at",
    "updated_at",
    "metadata",
    "*options",
    "*images",
    "product.id",
    "product.type_id",
];
exports.retrieveProductVariantConfig = {
    defaults: exports.defaultStoreProductVariantFields,
    isList: false,
};
exports.listProductVariantConfig = {
    ...exports.retrieveProductVariantConfig,
    defaultLimit: 20,
    isList: true,
};
//# sourceMappingURL=query-config.js.map