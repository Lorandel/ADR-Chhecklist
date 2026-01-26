# ADR Retention (60 zile) – fișiere pentru repo

Conține:
- supabase/schema.sql
- supabase/functions/purge-adr-checklists/index.ts

Acestea sunt suficiente pentru:
1) Tabel history
2) Edge Function care șterge automat din DB + Storage tot ce e expirat

Vezi pașii din chat pentru SQL + deploy + cron.
