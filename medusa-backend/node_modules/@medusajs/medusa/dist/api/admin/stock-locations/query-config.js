"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminStockLocationFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["stock_location"] = "stock_location";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminStockLocationFields = [
    "id",
    "name",
    "metadata",
    "created_at",
    "updated_at",
    "address.id",
    "address.address_1",
    "address.address_2",
    "address.city",
    "address.country_code",
    "address.phone",
    "address.province",
    "address.postal_code",
    "address.metadata",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminStockLocationFields,
    isList: false,
    entity: Entities.stock_location,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.stock_location,
};
//# sourceMappingURL=query-config.js.map