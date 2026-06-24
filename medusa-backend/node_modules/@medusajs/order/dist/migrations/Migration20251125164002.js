"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251125164002 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251125164002 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "order_change" add column if not exists "carry_over_promotions" boolean null;`);
    }
    async down() {
        this.addSql(`alter table if exists "order_change" drop column if exists "carry_over_promotions";`);
    }
}
exports.Migration20251125164002 = Migration20251125164002;
//# sourceMappingURL=Migration20251125164002.js.map