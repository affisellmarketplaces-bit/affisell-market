"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251016182939 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251016182939 extends migrations_1.Migration {
    async up() {
        // Step 1: Add the column
        this.addSql(`
      alter table if exists "order_credit_line"
        add column if not exists "version" integer default null;
    `);
        // Step 2: Populate the version column from the related order table
        this.addSql(`
      update "order_credit_line" ocl
      set "version" = o."version"
        from "order" o
      where ocl."order_id" = o."id";
    `);
        // Step 3: Set NOT NULL and default AFTER backfilling
        this.addSql(`
      alter table if exists "order_credit_line"
      alter column "version" set not null,
      alter column "version" set default 1;
    `);
        // Step 4: Add index for performance
        this.addSql(`
      create index if not exists "IDX_order_credit_line_order_id_version"
      on "order_credit_line" (order_id, version)
      where deleted_at is null;
    `);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_order_credit_line_order_id_version";`);
        this.addSql(`alter table if exists "order_credit_line" drop column if exists "version";`);
    }
}
exports.Migration20251016182939 = Migration20251016182939;
//# sourceMappingURL=Migration20251016182939.js.map