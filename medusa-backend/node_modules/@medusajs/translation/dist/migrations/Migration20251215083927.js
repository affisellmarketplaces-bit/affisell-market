"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251215083927 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251215083927 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "translation" add column if not exists "translated_field_count" integer not null default 0;`);
    }
    async down() {
        this.addSql(`alter table if exists "translation" drop column if exists "translated_field_count";`);
    }
}
exports.Migration20251215083927 = Migration20251215083927;
//# sourceMappingURL=Migration20251215083927.js.map