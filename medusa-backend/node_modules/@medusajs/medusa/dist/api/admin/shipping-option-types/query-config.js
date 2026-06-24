"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listShippingOptionTypesTransformQueryConfig = exports.retrieveShippingOptionTypeTransformQueryConfig = exports.defaultAdminShippingOptionTypeFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["shipping_option_type"] = "shipping_option_type";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminShippingOptionTypeFields = [
    "id",
    "label",
    "code",
    "description",
    "created_at",
    "updated_at",
];
exports.retrieveShippingOptionTypeTransformQueryConfig = {
    defaults: exports.defaultAdminShippingOptionTypeFields,
    isList: false,
    entity: Entities.shipping_option_type,
};
exports.listShippingOptionTypesTransformQueryConfig = {
    ...exports.retrieveShippingOptionTypeTransformQueryConfig,
    defaultLimit: 20,
    isList: true,
    entity: Entities.shipping_option_type,
};
//# sourceMappingURL=query-config.js.map