"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251114100559 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251114100559 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "order" add column if not exists "custom_display_id" text null;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_custom_display_id" ON "order" ("custom_display_id") WHERE deleted_at IS NULL;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_fulfilled_quantity" type jsonb using ("raw_fulfilled_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_fulfilled_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "order_item" alter column "raw_delivered_quantity" type jsonb using ("raw_delivered_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_delivered_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "order_item" alter column "raw_shipped_quantity" type jsonb using ("raw_shipped_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_shipped_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_requested_quantity" type jsonb using ("raw_return_requested_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_requested_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_received_quantity" type jsonb using ("raw_return_received_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_received_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_dismissed_quantity" type jsonb using ("raw_return_dismissed_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_dismissed_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "order_item" alter column "raw_written_off_quantity" type jsonb using ("raw_written_off_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_written_off_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "return_item" alter column "raw_received_quantity" type jsonb using ("raw_received_quantity"::jsonb);`);
        this.addSql(`alter table if exists "return_item" alter column "raw_received_quantity" set default '{"value":"0","precision":20}';`);
        this.addSql(`alter table if exists "return_item" alter column "raw_damaged_quantity" type jsonb using ("raw_damaged_quantity"::jsonb);`);
        this.addSql(`alter table if exists "return_item" alter column "raw_damaged_quantity" set default '{"value":"0","precision":20}';`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_order_custom_display_id";`);
        this.addSql(`alter table if exists "order" drop column if exists "custom_display_id";`);
        this.addSql(`alter table if exists "order_item" alter column "raw_fulfilled_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_fulfilled_quantity" type jsonb using ("raw_fulfilled_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_delivered_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_delivered_quantity" type jsonb using ("raw_delivered_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_shipped_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_shipped_quantity" type jsonb using ("raw_shipped_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_requested_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_requested_quantity" type jsonb using ("raw_return_requested_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_received_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_received_quantity" type jsonb using ("raw_return_received_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_dismissed_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_return_dismissed_quantity" type jsonb using ("raw_return_dismissed_quantity"::jsonb);`);
        this.addSql(`alter table if exists "order_item" alter column "raw_written_off_quantity" drop default;`);
        this.addSql(`alter table if exists "order_item" alter column "raw_written_off_quantity" type jsonb using ("raw_written_off_quantity"::jsonb);`);
        this.addSql(`alter table if exists "return_item" alter column "raw_received_quantity" drop default;`);
        this.addSql(`alter table if exists "return_item" alter column "raw_received_quantity" type jsonb using ("raw_received_quantity"::jsonb);`);
        this.addSql(`alter table if exists "return_item" alter column "raw_damaged_quantity" drop default;`);
        this.addSql(`alter table if exists "return_item" alter column "raw_damaged_quantity" type jsonb using ("raw_damaged_quantity"::jsonb);`);
    }
}
exports.Migration20251114100559 = Migration20251114100559;
//# sourceMappingURL=Migration20251114100559.js.map