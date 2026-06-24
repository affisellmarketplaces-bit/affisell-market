"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaults = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["tax_region"] = "tax_region";
})(Entities || (exports.Entities = Entities = {}));
exports.defaults = [
    "id",
    "country_code",
    "province_code",
    "parent_id",
    "provider_id",
    "created_by",
    "created_at",
    "updated_at",
    "deleted_at",
    "metadata",
    "*children",
    "*children.tax_rates",
    "*children.tax_rates.rules",
    "*parent",
    "*tax_rates",
    "*tax_rates.rules",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaults,
    isList: false,
    entity: Entities.tax_region,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.tax_region,
};
//# sourceMappingURL=query-config.js.map