-- Blind dropship: example RLS policies for Supabase (apply manually in SQL editor).
-- Prisma migrations do not manage RLS. Adjust `auth.uid()` mapping to your JWT claims.

-- alter table "BlindDropshipOrder" enable row level security;
-- create policy affiliate_reads_own_blind_orders on "BlindDropshipOrder"
--   for select using (affiliate_id = auth.uid()::text);
