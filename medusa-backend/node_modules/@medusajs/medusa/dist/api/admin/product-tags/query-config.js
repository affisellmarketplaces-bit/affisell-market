"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductTagsTransformQueryConfig = exports.retrieveProductTagTransformQueryConfig = exports.defaultAdminProductTagFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["product_tag"] = "product_tag";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminProductTagFields = [
    "id",
    "value",
    "external_id",
    "created_at",
    "updated_at",
    "metadata",
];
exports.retrieveProductTagTransformQueryConfig = {
    defaults: exports.defaultAdminProductTagFields,
    isList: false,
    entity: Entities.product_tag,
};
exports.listProductTagsTransformQueryConfig = {
    ...exports.retrieveProductTagTransformQueryConfig,
    defaultLimit: 20,
    isList: true,
    entity: Entities.product_tag,
};
//# sourceMappingURL=query-config.js.map