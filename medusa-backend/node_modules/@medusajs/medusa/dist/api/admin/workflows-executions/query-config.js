"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminWorkflowExecutionsFields = exports.defaultAdminWorkflowExecutionDetailFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["workflow_execution"] = "workflow_execution";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminWorkflowExecutionDetailFields = [
    "id",
    "workflow_id",
    "transaction_id",
    "context",
    "execution",
    "state",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.defaultAdminWorkflowExecutionsFields = [
    "id",
    "workflow_id",
    "transaction_id",
    "state",
    "execution",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminWorkflowExecutionDetailFields,
    isList: false,
    entity: Entities.workflow_execution,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    defaults: exports.defaultAdminWorkflowExecutionsFields,
    isList: true,
    entity: Entities.workflow_execution,
};
//# sourceMappingURL=query-config.js.map