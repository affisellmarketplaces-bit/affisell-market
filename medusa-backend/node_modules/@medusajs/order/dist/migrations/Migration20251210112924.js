"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251210112924 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251210112924 extends migrations_1.Migration {
    async up() {
        this.addSql(`drop index if exists "IDX_unique_order_item_version_item_id";`);
    }
    async down() { }
}
exports.Migration20251210112924 = Migration20251210112924;
//# sourceMappingURL=Migration20251210112924.js.map