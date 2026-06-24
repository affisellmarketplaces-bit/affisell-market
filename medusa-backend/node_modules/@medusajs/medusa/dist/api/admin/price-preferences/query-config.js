"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPricePreferenceQueryConfig = exports.retrivePricePreferenceQueryConfig = exports.adminPricePreferenceRemoteQueryFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["price_preference"] = "price_preference";
})(Entities || (exports.Entities = Entities = {}));
exports.adminPricePreferenceRemoteQueryFields = [
    "id",
    "attribute",
    "value",
    "is_tax_inclusive",
    "created_at",
    "deleted_at",
    "updated_at",
];
exports.retrivePricePreferenceQueryConfig = {
    defaults: exports.adminPricePreferenceRemoteQueryFields,
    isList: false,
    entity: Entities.price_preference,
};
exports.listPricePreferenceQueryConfig = {
    ...exports.retrivePricePreferenceQueryConfig,
    isList: true,
    entity: Entities.price_preference,
};
//# sourceMappingURL=query-config.js.map