"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251107050148 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251107050148 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "promotion" add column if not exists "metadata" jsonb null;`);
    }
    async down() {
        this.addSql(`alter table if exists "promotion" drop column if exists "metadata";`);
    }
}
exports.Migration20251107050148 = Migration20251107050148;
//# sourceMappingURL=Migration20251107050148.js.map