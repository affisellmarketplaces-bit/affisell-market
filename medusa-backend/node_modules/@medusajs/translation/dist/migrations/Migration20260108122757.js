"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260108122757 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260108122757 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "translation_settings" add column if not exists "is_active" boolean not null default true;`);
    }
    async down() {
        this.addSql(`alter table if exists "translation_settings" drop column if exists "is_active";`);
    }
}
exports.Migration20260108122757 = Migration20260108122757;
//# sourceMappingURL=Migration20260108122757.js.map