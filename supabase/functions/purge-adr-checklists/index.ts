// supabase/functions/purge-adr-checklists/index.ts
//
// Edge Function care șterge automat (zilnic prin cron) toate rândurile expirate (expires_at < now())
// + șterge fișierele ZIP din Supabase Storage bucket-ul "adr-checklists".
//
// IMPORTANT:
// - NU ștergem rânduri din DB dacă ștergerea din Storage eșuează (altfel rămân fișiere orfane în bucket).
// - Acceptăm drept "ok" cazul în care obiectul nu mai există (404/not found).
//
// Protecție: cere header "x-cron-secret" == CRON_SECRET (setat ca secret la function).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ChecklistRow = {
  id: string;
  file_path: string;
};

function normalizePath(p?: string | null) {
  if (!p) return "";
  // acceptă: "reduced/abc.zip", "/reduced/abc.zip", "adr-checklists/reduced/abc.zip"
  return String(p).replace(/^\/+/, "").replace(/^adr-checklists\//, "");
}

function isNotFoundStorageError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? "").toLowerCase();
  // diferite formate de eroare/mesaj în funcție de endpoint
  return msg.includes("not found") || msg.includes("404") || msg.includes("no such") || msg.includes("object") && msg.includes("missing");
}

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

  const nowIso = new Date().toISOString();

  let deletedRows = 0;
  let storageDeleteTried = 0;
  let storageDeleteOk = 0;
  let storageDeleteFailed = 0;

  const failedSample: Array<{ id: string; path: string; message: string }> = [];

  for (;;) {
    const { data, error } = await supabase
      .from("adr_checklists")
      .select("id,file_path")
      .lt("expires_at", nowIso)
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

    const okIds: string[] = [];

    for (const r of rows) {
      const path = normalizePath(r.file_path);

      // dacă nu avem path, putem șterge doar rândul din DB
      if (!path) {
        okIds.push(r.id);
        continue;
      }

      storageDeleteTried += 1;
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);

      if (!storageError || isNotFoundStorageError(storageError)) {
        storageDeleteOk += 1;
        okIds.push(r.id);
      } else {
        storageDeleteFailed += 1;
        if (failedSample.length < 20) {
          failedSample.push({
            id: r.id,
            path,
            message: String(storageError.message ?? storageError),
          });
        }
      }
    }

    // Dacă nu am reușit să curățăm niciun rând în acest batch, evităm loop infinit.
    if (okIds.length === 0) {
      break;
    }

    const { error: delError } = await supabase.from("adr_checklists").delete().in("id", okIds);

    if (delError) {
      return new Response(JSON.stringify({ error: delError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    deletedRows += okIds.length;
  }

  return new Response(
    JSON.stringify({
      ok: storageDeleteFailed === 0,
      deleted_rows: deletedRows,
      storage_delete_tried: storageDeleteTried,
      storage_delete_ok: storageDeleteOk,
      storage_delete_failed: storageDeleteFailed,
      failed_sample: failedSample,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
