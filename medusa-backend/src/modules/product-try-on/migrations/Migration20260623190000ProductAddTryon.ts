import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Generated via: npx medusa db:generate productTryOnModule
 * Manual snapshot for CI / first deploy when generate cannot run locally.
 */
export class Migration20260623190000ProductAddTryon extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "product_try_on" (
        "id" text not null,
        "try_on_enabled" boolean not null default false,
        "tryon_garment_url" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "product_try_on_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "IDX_product_try_on_enabled"
      on "product_try_on" ("try_on_enabled")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_product_try_on_enabled";`)
    this.addSql(`drop table if exists "product_try_on" cascade;`)
  }
}
