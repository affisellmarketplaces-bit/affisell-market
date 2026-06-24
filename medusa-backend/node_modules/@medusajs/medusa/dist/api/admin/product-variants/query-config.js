"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductVariantQueryConfig = exports.retrieveProductVariantQueryConfig = exports.defaultAdminProductVariantFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["product_variant"] = "product_variant";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminProductVariantFields = [
    "id",
    "title",
    "sku",
    "thumbnail",
    "barcode",
    "ean",
    "upc",
    "allow_backorder",
    "manage_inventory",
    "hs_code",
    "origin_country",
    "mid_code",
    "material",
    "weight",
    "length",
    "height",
    "width",
    "metadata",
    "variant_rank",
    "product_id",
    "created_at",
    "updated_at",
    "deleted_at",
    "*product",
    "*prices",
    "*options",
    "prices.price_rules.value",
    "prices.price_rules.attribute",
];
exports.retrieveProductVariantQueryConfig = {
    defaults: exports.defaultAdminProductVariantFields,
    isList: false,
    entity: Entities.product_variant,
};
exports.listProductVariantQueryConfig = {
    ...exports.retrieveProductVariantQueryConfig,
    defaultLimit: 50,
    isList: true,
    entity: Entities.product_variant,
};
//# sourceMappingURL=query-config.js.map