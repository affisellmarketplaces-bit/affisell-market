"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250908080326 = void 0;
const migrations_1 = require("@medusajs/deps/mikro-orm/migrations");
class Migration20250908080326 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_workflow_id_transaction_id" ON "workflow_execution" (workflow_id, transaction_id) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_state_updated_at" ON "workflow_execution" (state, updated_at) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_retention_time_updated_at_state" ON "workflow_execution" (retention_time, updated_at, state) WHERE deleted_at IS NULL AND retention_time IS NOT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_updated_at_retention_time" ON "workflow_execution" (updated_at, retention_time) WHERE deleted_at IS NULL AND retention_time IS NOT NULL AND state IN ('done', 'failed', 'reverted');`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_workflow_execution_workflow_id_transaction_id";`);
        this.addSql(`drop index if exists "IDX_workflow_execution_state_updated_at";`);
        this.addSql(`drop index if exists "IDX_workflow_execution_retention_time_updated_at_state";`);
        this.addSql(`drop index if exists "IDX_workflow_execution_updated_at_retention_time";`);
    }
}
exports.Migration20250908080326 = Migration20250908080326;
//# sourceMappingURL=Migration20250908080326.js.map