"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminDetailsReturnFields = exports.defaultAdminReturnFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["return"] = "return";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminReturnFields = [
    "id",
    "order_id",
    "exchange_id",
    "claim_id",
    "display_id",
    "location_id",
    "order_version",
    "status",
    "metadata",
    "no_notification",
    "refund_amount",
    "created_by",
    "created_at",
    "updated_at",
    "canceled_at",
    "requested_at",
    "received_at",
];
exports.defaultAdminDetailsReturnFields = [
    ...exports.defaultAdminReturnFields,
    "items.*",
    "items.reason.*",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminDetailsReturnFields,
    isList: false,
    entity: Entities.return,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminReturnFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.return,
};
//# sourceMappingURL=query-config.js.map