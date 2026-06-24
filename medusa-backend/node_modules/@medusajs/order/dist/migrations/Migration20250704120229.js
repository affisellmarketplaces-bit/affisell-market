"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250704120229 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250704120229 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "order_credit_line" drop constraint if exists "order_credit_line_order_id_foreign";`);
        this.addSql(`alter table if exists "order_credit_line" add constraint "order_credit_line_order_id_foreign" foreign key ("order_id") references "order" ("id") on update cascade on delete cascade;`);
    }
    async down() {
        this.addSql(`alter table if exists "order_credit_line" drop constraint if exists "order_credit_line_order_id_foreign";`);
        this.addSql(`alter table if exists "order_credit_line" add constraint "order_credit_line_order_id_foreign" foreign key ("order_id") references "order" ("id") on update cascade;`);
    }
}
exports.Migration20250704120229 = Migration20250704120229;
//# sourceMappingURL=Migration20250704120229.js.map