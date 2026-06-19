import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
// IMPORTANT: This endpoint must never be cached (Vercel/Next can cache GET route handlers).
// Otherwise you may keep seeing an old empty response even after rows exist in DB.
export const dynamic = "force-dynamic"
export const revalidate = 0

const bucket = "adr-checklists"

function normalizePath(p?: string | null) {
  if (!p) return ""
  return p.replace(/^\/+/, "").replace(/^adr-checklists\//, "")
}

function expiryCutoffEndOfTodayIso() {
  const cutoff = new Date()
  cutoff.setUTCHours(23, 59, 59, 999)
  return cutoff.toISOString()
}

async function purgeExpiredHistoryRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const cutoffIso = expiryCutoffEndOfTodayIso()

  const expired = await supabase
    .from("adr_checklists")
    .select("id, file_path")
    .lte("expires_at", cutoffIso)
    .limit(100)

  if (expired.error || !Array.isArray(expired.data) || expired.data.length === 0) return

  const ids = expired.data.map((row: any) => row.id).filter(Boolean)
  const paths = Array.from(new Set(expired.data.map((row: any) => normalizePath(row.file_path)).filter(Boolean)))

  if (paths.length > 0) {
    try {
      await supabase.storage.from(bucket).remove(paths)
    } catch {
      // Storage cleanup is best-effort. Do not block the History list if a file is already missing.
    }
  }

  if (ids.length > 0) {
    try {
      await supabase.from("adr_checklists").delete().in("id", ids)
    } catch {
      // DB cleanup is best-effort from the History modal.
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") // full|reduced|...
    const cutoffIso = expiryCutoffEndOfTodayIso()

    // Best-effort cleanup when History is opened, so ZIPs disappear on the calendar day they expire.
    // It must never make History fail to load.
    try {
      await purgeExpiredHistoryRows(supabase)
    } catch {
      // ignore cleanup errors
    }

    let query = supabase
      .from("adr_checklists")
      .select("id, checklist_type, checklist_hash, file_path, created_at, expires_at, email_sent, meta")
      .gt("expires_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(100)

    if (type === "full" || type === "reduced") {
      query = query.eq("checklist_type", type)
    }

    const res = await query
    if (res.error) {
      return NextResponse.json({ success: false, message: res.error.message }, { status: 500 })
    }

    // The modal downloads/previews through same-origin API routes by id, so generating signed URLs
    // for every history item here is unnecessary and uses extra Supabase resources/RAM.
    const items = (Array.isArray(res.data) ? res.data : []).map((row: any) => ({
      ...row,
      file_path: normalizePath(row.file_path) || row.file_path,
    }))

    return NextResponse.json(
      { success: true, items },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    )
  } catch (error: any) {
    const message = error?.message || "Failed to load history"
    return NextResponse.json({ success: false, message, error: message }, { status: 500 })
  }
}
