"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPriceListQueryConfig = exports.retrivePriceListQueryConfig = exports.listPriceListPriceQueryConfig = exports.retrivePriceListPriceQueryConfig = exports.adminPriceListRemoteQueryFields = exports.adminPriceListPriceQueryFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["price_list"] = "price_list";
    Entities["price"] = "price";
})(Entities || (exports.Entities = Entities = {}));
// Note: renamed to avoid referencing remoteQuery which is legacy
exports.adminPriceListPriceQueryFields = [
    "id",
    "currency_code",
    "amount",
    "min_quantity",
    "max_quantity",
    "created_at",
    "deleted_at",
    "updated_at",
    "price_set.variant.id",
    "price_rules.value",
    "price_rules.attribute",
];
exports.adminPriceListRemoteQueryFields = [
    "id",
    "type",
    "description",
    "title",
    "status",
    "starts_at",
    "ends_at",
    "created_at",
    "updated_at",
    "deleted_at",
    "metadata",
    "price_list_rules.value",
    "price_list_rules.attribute",
];
exports.retrivePriceListPriceQueryConfig = {
    defaults: exports.adminPriceListPriceQueryFields,
    isList: false,
    entity: Entities.price_list,
};
exports.listPriceListPriceQueryConfig = {
    ...exports.retrivePriceListPriceQueryConfig,
    isList: true,
    entity: Entities.price_list,
};
exports.retrivePriceListQueryConfig = {
    defaults: exports.adminPriceListRemoteQueryFields,
    isList: false,
    entity: Entities.price_list,
};
exports.listPriceListQueryConfig = {
    ...exports.retrivePriceListQueryConfig,
    isList: true,
    entity: Entities.price_list,
};
//# sourceMappingURL=query-config.js.map