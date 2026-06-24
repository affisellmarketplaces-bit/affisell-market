"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250625084134 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250625084134 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "payment_collection" drop constraint if exists "payment_collection_status_check";`);
        this.addSql(`alter table if exists "payment_collection" add constraint "payment_collection_status_check" check("status" in ('not_paid', 'awaiting', 'authorized', 'partially_authorized', 'canceled', 'failed', 'partially_captured', 'completed'));`);
    }
    async down() {
        this.addSql(`alter table if exists "payment_collection" drop constraint if exists "payment_collection_status_check";`);
        this.addSql(`alter table if exists "payment_collection" add constraint "payment_collection_status_check" check("status" in ('not_paid', 'awaiting', 'authorized', 'partially_authorized', 'canceled', 'failed', 'completed'));`);
    }
}
exports.Migration20250625084134 = Migration20250625084134;
//# sourceMappingURL=Migration20250625084134.js.map