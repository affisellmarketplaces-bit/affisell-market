"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminDetailsExchangeFields = exports.defaultAdminExchangeFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["order_exchange"] = "order_exchange";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminExchangeFields = [
    "id",
    "order_id",
    "return_id",
    "display_id",
    "order_version",
    "created_by",
    "created_at",
    "updated_at",
    "canceled_at",
];
exports.defaultAdminDetailsExchangeFields = [
    ...exports.defaultAdminExchangeFields,
    "additional_items.*",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminDetailsExchangeFields,
    isList: false,
    entity: Entities.order_exchange,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminExchangeFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.order_exchange,
};
//# sourceMappingURL=query-config.js.map