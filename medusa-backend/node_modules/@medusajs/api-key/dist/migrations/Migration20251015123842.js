"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251015123842 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251015123842 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_api_key_revoked_at" ON "api_key" (revoked_at) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_api_key_redacted" ON "api_key" (redacted) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_api_key_revoked_at";`);
        this.addSql(`drop index if exists "IDX_api_key_redacted";`);
    }
}
exports.Migration20251015123842 = Migration20251015123842;
//# sourceMappingURL=Migration20251015123842.js.map