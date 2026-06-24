"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251212161429 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251212161429 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "store_locale" drop column if exists "is_default";`);
    }
    async down() {
        this.addSql(`alter table if exists "store_locale" add column if not exists "is_default" boolean not null default false;`);
    }
}
exports.Migration20251212161429 = Migration20251212161429;
//# sourceMappingURL=Migration20251212161429.js.map