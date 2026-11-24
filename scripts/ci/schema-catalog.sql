-- Catalogue facts of the public schema, one per line: kind|key|value (read-only; used by check-schema-drift.ts).
SELECT 'index|' || indexname || '|' || indexdef
FROM pg_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 'column|' || c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod)
       || ' | ' || coalesce(pg_get_expr(d.adbin, d.adrelid), '<none>')
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
UNION ALL
SELECT 'check|' || cl.relname || '.' || co.conname || '|' || pg_get_constraintdef(co.oid)
FROM pg_constraint co
JOIN pg_class cl ON cl.oid = co.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public' AND co.contype = 'c'
ORDER BY 1;
