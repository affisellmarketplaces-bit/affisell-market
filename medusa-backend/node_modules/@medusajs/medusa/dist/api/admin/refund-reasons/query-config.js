"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminRetrieveRefundReasonFields = exports.defaultAdminRefundReasonFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["refund_reason"] = "refund_reason";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminRefundReasonFields = [
    "id",
    "label",
    "code",
    "description",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.defaultAdminRetrieveRefundReasonFields = [
    ...exports.defaultAdminRefundReasonFields,
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminRetrieveRefundReasonFields,
    isList: false,
    entity: Entities.refund_reason,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminRefundReasonFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.refund_reason,
};
//# sourceMappingURL=query-config.js.map