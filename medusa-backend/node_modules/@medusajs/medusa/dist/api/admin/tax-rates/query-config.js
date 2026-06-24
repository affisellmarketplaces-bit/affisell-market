"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaults = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["tax_rate"] = "tax_rate";
})(Entities || (exports.Entities = Entities = {}));
exports.defaults = [
    "id",
    "name",
    "code",
    "rate",
    "tax_region_id",
    "is_default",
    "is_combinable",
    "created_by",
    "created_at",
    "updated_at",
    "deleted_at",
    "metadata",
    "*tax_region",
    "*rules",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaults,
    isList: false,
    entity: Entities.tax_rate,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaults,
    isList: true,
    entity: Entities.tax_rate,
};
//# sourceMappingURL=query-config.js.map