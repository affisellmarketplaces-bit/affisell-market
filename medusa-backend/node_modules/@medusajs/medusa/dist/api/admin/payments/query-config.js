"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformPaymentProvidersQueryConfig = exports.defaultAdminPaymentPaymentProviderFields = exports.retrieveTransformQueryConfig = exports.listTransformQueryConfig = exports.defaultAdminPaymentFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["payment"] = "payment";
    Entities["capture"] = "capture";
    Entities["refund"] = "refund";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminPaymentFields = [
    "id",
    "currency_code",
    "amount",
    "captured_at",
    "payment_collection_id",
    "payment_session_id",
    "captures.id",
    "captures.amount",
    "refunds.id",
    "refunds.amount",
    "refunds.note",
    "refunds.payment_id",
    "refunds.refund_reason.label",
    "refunds.refund_reason.code",
];
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminPaymentFields,
    isList: true,
    entity: Entities.payment,
};
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminPaymentFields,
    isList: false,
    entity: Entities.payment,
};
exports.defaultAdminPaymentPaymentProviderFields = ["id", "is_enabled"];
exports.listTransformPaymentProvidersQueryConfig = {
    defaults: exports.defaultAdminPaymentPaymentProviderFields,
    isList: true,
};
//# sourceMappingURL=query-config.js.map