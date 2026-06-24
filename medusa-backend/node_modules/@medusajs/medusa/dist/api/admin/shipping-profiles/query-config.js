"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminShippingProfileFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["shipping_profile"] = "shipping_profile";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminShippingProfileFields = [
    "id",
    "name",
    "type",
    "metadata",
    "created_at",
    "updated_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminShippingProfileFields,
    isList: false,
    entity: Entities.shipping_profile,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.shipping_profile,
};
//# sourceMappingURL=query-config.js.map