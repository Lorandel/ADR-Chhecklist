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
    await supabase.storage.from(bucket).remove(paths).catch(() => null)
  }

  if (ids.length > 0) {
    await supabase.from("adr_checklists").delete().in("id", ids).catch(() => null)
  }
}

async function signedUrlForFirstAvailable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  paths: string[],
): Promise<string | null> {
  for (const p of paths) {
    if (!p) continue
    const signed = await supabase.storage.from(bucket).createSignedUrl(p, 60 * 60)
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") // full|reduced|... 
    const cutoffIso = expiryCutoffEndOfTodayIso()

    // Best-effort cleanup when History is opened, so ZIPs disappear on the calendar day they expire.
    await purgeExpiredHistoryRows(supabase)

    let query = supabase
      .from("adr_checklists")
      .select("id, checklist_type, checklist_hash, file_path, created_at, expires_at, email_sent, meta")
      .gt("expires_at", cutoffIso)
      .order("created_at", { ascending: false })

    if (type === "full" || type === "reduced") {
      query = query.eq("checklist_type", type)
    }

    const res = await query
    if (res.error) {
      return NextResponse.json({ success: false, message: res.error.message }, { status: 500 })
    }

    const rows = Array.isArray(res.data) ? res.data : []

    // Create signed URLs (valid 1 hour) for each item.
    const items = await Promise.all(
      rows.map(async (row) => {
        const t = row.checklist_type as "reduced" | "full"
        const hash = row.checklist_hash as string
        const stored = normalizePath(row.file_path as any)

        const candidates = Array.from(
          new Set([
            stored,
            `${t}/${hash}.zip`,
            // legacy reduced path
            t === "reduced" ? `under1000/${hash}.zip` : "",
          ]),
        ).filter(Boolean)

        const downloadUrl = await signedUrlForFirstAvailable(supabase, candidates)
        return { ...row, file_path: stored || row.file_path, downloadUrl }
      }),
    )

    return NextResponse.json(
      { success: true, items },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Failed to load history", error: error?.message },
      { status: 500 },
    )
  }
}
