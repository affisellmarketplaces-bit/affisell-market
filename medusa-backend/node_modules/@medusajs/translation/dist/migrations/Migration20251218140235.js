"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251218140235 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251218140235 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "translation_settings" drop constraint if exists "translation_settings_entity_type_unique";`);
        this.addSql(`create table if not exists "translation_settings" ("id" text not null, "entity_type" text not null, "fields" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "translation_settings_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_translation_settings_deleted_at" ON "translation_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_translation_settings_entity_type_unique" ON "translation_settings" ("entity_type") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "translation_settings" cascade;`);
    }
}
exports.Migration20251218140235 = Migration20251218140235;
//# sourceMappingURL=Migration20251218140235.js.map