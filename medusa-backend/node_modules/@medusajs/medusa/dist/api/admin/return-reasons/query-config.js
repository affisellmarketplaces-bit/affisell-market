"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminRetrieveReturnReasonFields = exports.defaultAdminReturnReasonFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["return_reason"] = "return_reason";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminReturnReasonFields = [
    "id",
    "value",
    "label",
    "parent_return_reason_id",
    "description",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.defaultAdminRetrieveReturnReasonFields = [
    "id",
    "value",
    "label",
    "parent_return_reason_id",
    "description",
    "created_at",
    "updated_at",
    "deleted_at",
    "parent_return_reason.*",
    "return_reason_children.*",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminRetrieveReturnReasonFields,
    isList: false,
    entity: Entities.return_reason,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminReturnReasonFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.return_reason,
};
//# sourceMappingURL=query-config.js.map