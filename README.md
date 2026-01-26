Project is live at https://v0-adr-check-list.vercel.app/

## Supabase (ADR Checklists History)

This project stores **ADR Checklists ZIPs (PDF + photos)** in Supabase for **60 days** and exposes them in the UI via **ADR Checklists History**.

### 1) Create Supabase resources

1. Create a Supabase project.
2. Create a Storage bucket named: `adr-checklists`
3. Run the SQL in `supabase/schema.sql` to create the `adr_checklists` table.

### 2) Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

(Email variables are still required for the **Send ZIP via Email** feature.)

### 3) 60-day cleanup

This app sets `expires_at = now() + 60 days` for each stored ZIP.

To automatically delete expired rows/files, create a scheduled Supabase Edge Function or cron job that:

- selects rows where `expires_at < now()`
- deletes the Storage object at `file_path`
- deletes the row from `adr_checklists`
