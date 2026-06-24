"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecution = void 0;
const orchestration_1 = require("@medusajs/framework/orchestration");
const utils_1 = require("@medusajs/framework/utils");
exports.WorkflowExecution = utils_1.model
    .define("workflow_execution", {
    id: utils_1.model.id({ prefix: "wf_exec" }),
    workflow_id: utils_1.model.text().primaryKey(),
    transaction_id: utils_1.model.text().primaryKey(),
    run_id: utils_1.model.text().primaryKey(),
    execution: utils_1.model.json().nullable(),
    context: utils_1.model.json().nullable(),
    state: utils_1.model.enum(orchestration_1.TransactionState),
    retention_time: utils_1.model.number().nullable(),
})
    .indexes([
    {
        on: ["id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["workflow_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["transaction_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["workflow_id", "transaction_id", "run_id"],
        unique: true,
        where: "deleted_at IS NULL",
    },
    {
        on: ["state"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["run_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["workflow_id", "transaction_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["state", "updated_at"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["retention_time", "updated_at", "state"],
        where: "deleted_at IS NULL AND retention_time IS NOT NULL",
    },
    {
        on: ["updated_at", "retention_time"],
        where: "deleted_at IS NULL AND retention_time IS NOT NULL AND state IN ('done', 'failed', 'reverted')",
    },
]);
//# sourceMappingURL=workflow-execution.js.map