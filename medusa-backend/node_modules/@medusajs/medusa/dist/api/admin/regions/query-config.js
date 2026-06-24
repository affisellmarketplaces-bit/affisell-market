"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminRegionFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["region"] = "region";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminRegionFields = [
    "id",
    "name",
    "currency_code",
    "created_at",
    "updated_at",
    "deleted_at",
    "automatic_taxes",
    "metadata",
    "*countries",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminRegionFields,
    isList: false,
    entity: Entities.region,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminRegionFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.region,
};
//# sourceMappingURL=query-config.js.map