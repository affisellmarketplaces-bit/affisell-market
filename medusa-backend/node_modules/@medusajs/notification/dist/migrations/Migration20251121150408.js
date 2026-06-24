"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251121150408 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251121150408 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "notification" add column if not exists "provider_data" jsonb null;`);
    }
    async down() {
        this.addSql(`alter table if exists "notification" drop column if exists "provider_data";`);
    }
}
exports.Migration20251121150408 = Migration20251121150408;
//# sourceMappingURL=Migration20251121150408.js.map