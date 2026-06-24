"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminCollectionFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["product_collection"] = "product_collection";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminCollectionFields = [
    "id",
    "title",
    "handle",
    "external_id",
    "created_at",
    "updated_at",
    "metadata",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminCollectionFields,
    isList: false,
    entity: Entities.product_collection,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    defaultLimit: 10,
    isList: true,
    entity: Entities.product_collection,
};
//# sourceMappingURL=query-config.js.map