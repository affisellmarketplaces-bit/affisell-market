"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrievePaymentCollectionTransformQueryConfig = exports.defaultPaymentCollectionFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["payment_collection"] = "payment_collection";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultPaymentCollectionFields = [
    "id",
    "currency_code",
    "amount",
    "status",
    "authorized_amount",
    "captured_amount",
    "refunded_amount",
    "*payment_sessions",
    "*payments",
];
exports.retrievePaymentCollectionTransformQueryConfig = {
    defaults: exports.defaultPaymentCollectionFields,
    isList: false,
    entity: Entities.payment_collection,
};
//# sourceMappingURL=query-config.js.map