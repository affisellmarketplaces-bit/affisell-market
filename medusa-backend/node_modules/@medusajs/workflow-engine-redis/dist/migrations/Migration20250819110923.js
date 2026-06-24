"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250819110923 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250819110923 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_run_id" ON "workflow_execution" (run_id) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_workflow_execution_run_id";`);
    }
}
exports.Migration20250819110923 = Migration20250819110923;
//# sourceMappingURL=Migration20250819110923.js.map