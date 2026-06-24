"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductTypesTransformQueryConfig = exports.retrieveProductTypeTransformQueryConfig = exports.defaultAdminProductTypeFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["product_type"] = "product_type";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminProductTypeFields = [
    "id",
    "value",
    "external_id",
    "created_at",
    "updated_at",
    "metadata",
];
exports.retrieveProductTypeTransformQueryConfig = {
    defaults: exports.defaultAdminProductTypeFields,
    isList: false,
    entity: Entities.product_type,
};
exports.listProductTypesTransformQueryConfig = {
    ...exports.retrieveProductTypeTransformQueryConfig,
    defaultLimit: 20,
    isList: true,
    entity: Entities.product_type,
};
//# sourceMappingURL=query-config.js.map