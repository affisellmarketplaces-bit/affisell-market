"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250929124701 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250929124701 extends migrations_1.Migration {
    async up() {
        // Step 1: Add the column as nullable
        this.addSql(`alter table "refund_reason" add column "code" text;`);
        // Step 2: Populate the code column from label (convert to snake_case)
        this.addSql(`
      update "refund_reason" 
      set "code" = lower(replace("label", ' ', '_'));
    `);
        // Step 3: Set the column to not nullable
        this.addSql(`alter table "refund_reason" alter column "code" set not null;`);
    }
    async down() {
        // Remove the code column
        this.addSql(`alter table "refund_reason" drop column "code";`);
    }
}
exports.Migration20250929124701 = Migration20250929124701;
//# sourceMappingURL=Migration20250929124701.js.map