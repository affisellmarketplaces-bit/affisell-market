"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251210112909 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251210112909 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "order" add column if not exists "locale" text null;`);
    }
    async down() {
        this.addSql(`alter table if exists "order" drop column if exists "locale";`);
    }
}
exports.Migration20251210112909 = Migration20251210112909;
//# sourceMappingURL=Migration20251210112909.js.map