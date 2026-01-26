// supabase/functions/purge-adr-checklists/index.ts
//
// Edge Function care șterge automat (zilnic prin cron) toate rândurile expirate (expires_at < now())
// + șterge fișierele ZIP din Supabase Storage bucket-ul "adr-checklists".
//
// Protecție: cere header "x-cron-secret" == CRON_SECRET (setat ca secret la function).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ChecklistRow = {
  id: string;
  file_path: string;
};

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const incoming = req.headers.get("x-cron-secret") ?? "";

  if (!cronSecret || incoming !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const BUCKET = "adr-checklists";
  const BATCH = 200;

  let deletedRows = 0;
  let deletedFilesAttempted = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("adr_checklists")
      .select("id,file_path")
      .lt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(BATCH);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = (data ?? []) as ChecklistRow[];
    if (rows.length === 0) break;

    const paths = rows.map((r) => r.file_path).filter(Boolean);

    // 1) Șterge fișierele din Storage
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      // Dacă unele fișiere lipsesc deja, continuăm oricum cu ștergerea din DB.
      if (!storageError) deletedFilesAttempted += paths.length;
    }

    // 2) Șterge rândurile din DB
    const ids = rows.map((r) => r.id);
    const { error: delError } = await supabase.from("adr_checklists").delete().in("id", ids);

    if (delError) {
      return new Response(JSON.stringify({ error: delError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    deletedRows += ids.length;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      deleted_rows: deletedRows,
      deleted_files_attempted: deletedFilesAttempted,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
