"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminDetailsOrderEditFields = exports.defaultAdminOrderEditFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["order"] = "order";
    Entities["order_change"] = "order_change";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminOrderEditFields = [
    "id",
    "order_id",
    "display_id",
    "order_version",
    "created_at",
    "updated_at",
    "canceled_at",
];
exports.defaultAdminDetailsOrderEditFields = [
    ...exports.defaultAdminOrderEditFields,
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminDetailsOrderEditFields,
    isList: false,
    entity: Entities.order,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminOrderEditFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.order,
};
//# sourceMappingURL=query-config.js.map