"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250508081553 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250508081553 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "cart_line_item_adjustment" add column if not exists "is_tax_inclusive" boolean not null default false;`);
    }
    async down() {
        this.addSql(`alter table if exists "cart_line_item_adjustment" drop column if exists "is_tax_inclusive";`);
    }
}
exports.Migration20250508081553 = Migration20250508081553;
//# sourceMappingURL=Migration20250508081553.js.map