"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductCategoryConfig = exports.retrieveProductCategoryConfig = exports.allowed = exports.defaults = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["product_category"] = "product_category";
})(Entities || (exports.Entities = Entities = {}));
exports.defaults = [
    "id",
    "name",
    "description",
    "handle",
    "is_active",
    "is_internal",
    "rank",
    "external_id",
    "parent_category_id",
    "created_at",
    "updated_at",
    "metadata",
    "*parent_category",
    "*category_children",
];
exports.allowed = [
    "id",
    "name",
    "description",
    "handle",
    "is_active",
    "is_internal",
    "rank",
    "external_id",
    "parent_category_id",
    "created_at",
    "updated_at",
    "metadata",
    "category_children",
    "parent_category",
    "products",
    "translations",
];
exports.retrieveProductCategoryConfig = {
    defaults: exports.defaults,
    allowed: exports.allowed,
    isList: false,
    entity: Entities.product_category,
};
exports.listProductCategoryConfig = {
    defaults: exports.defaults,
    allowed: exports.allowed,
    defaultLimit: 50,
    isList: true,
    entity: Entities.product_category,
};
//# sourceMappingURL=query-config.js.map