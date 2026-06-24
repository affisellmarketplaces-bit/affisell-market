"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251017155709 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251017155709 extends migrations_1.Migration {
    async up() {
        this.addSql(`drop index if exists "IDX_order_item_version";`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_item_order_id_version" ON "order_item" (order_id, version) WHERE deleted_at IS NULL;`);
        this.addSql(`drop index if exists "IDX_order_shipping_version";`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_shipping_order_id_version" ON "order_shipping" (order_id, version) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_order_item_order_id_version";`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_item_version" ON "order_item" (order_id, version) WHERE deleted_at IS NULL;`);
        this.addSql(`drop index if exists "IDX_order_shipping_order_id_version";`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_shipping_version" ON "order_shipping" (order_id, version) WHERE deleted_at IS NULL;`);
    }
}
exports.Migration20251017155709 = Migration20251017155709;
//# sourceMappingURL=Migration20251017155709.js.map