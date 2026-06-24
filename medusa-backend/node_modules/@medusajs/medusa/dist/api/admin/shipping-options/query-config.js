"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRuleTransformQueryConfig = exports.retrieveRuleTransformQueryConfig = exports.defaultAdminShippingOptionRuleFields = exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminShippingOptionFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["shipping_option"] = "shipping_option";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminShippingOptionFields = [
    "id",
    "name",
    "price_type",
    "data",
    "provider_id",
    "metadata",
    "created_at",
    "updated_at",
    "*rules",
    "*type",
    "*prices",
    "*prices.price_rules",
    "*service_zone",
    "*shipping_profile",
    "*provider",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminShippingOptionFields,
    isList: false,
    entity: Entities.shipping_option,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.shipping_option,
};
exports.defaultAdminShippingOptionRuleFields = [
    "id",
    "description",
    "attribute",
    "operator",
    "values.value",
];
exports.retrieveRuleTransformQueryConfig = {
    defaults: exports.defaultAdminShippingOptionRuleFields,
    isList: false,
};
exports.listRuleTransformQueryConfig = {
    ...exports.retrieveRuleTransformQueryConfig,
    isList: true,
};
//# sourceMappingURL=query-config.js.map