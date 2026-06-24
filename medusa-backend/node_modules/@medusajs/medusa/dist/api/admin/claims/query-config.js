"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminDetailsClaimFields = exports.defaultAdminClaimFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["order_claim"] = "order_claim";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminClaimFields = [
    "id",
    "type",
    "order_id",
    "return_id",
    "display_id",
    "order_version",
    "refund_amount",
    "created_by",
    "created_at",
    "updated_at",
    "canceled_at",
];
exports.defaultAdminDetailsClaimFields = [
    ...exports.defaultAdminClaimFields,
    "additional_items.*",
    "claim_items.*",
    "claim_items.reason.*",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminDetailsClaimFields,
    isList: false,
    entity: Entities.order_claim,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminClaimFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.order_claim,
};
//# sourceMappingURL=query-config.js.map