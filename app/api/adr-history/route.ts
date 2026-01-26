import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
// IMPORTANT: This endpoint must never be cached (Vercel/Next can cache GET route handlers).
// Otherwise you may keep seeing an old empty response even after rows exist in DB.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") // full|reduced|... 

    let query = supabase
      .from("adr_checklists")
      .select("id, checklist_type, checklist_hash, file_path, created_at, expires_at, email_sent, meta")
      .order("created_at", { ascending: false })

    if (type === "full" || type === "reduced") {
      query = query.eq("checklist_type", type)
    }

    const res = await query
    if (res.error) {
      return NextResponse.json({ success: false, message: res.error.message }, { status: 500 })
    }

    const bucket = "adr-checklists"
    const rows = Array.isArray(res.data) ? res.data : []

    // Create signed URLs (valid 1 hour) for each item.
    const items = await Promise.all(
      rows.map(async (row) => {
        let downloadUrl: string | null = null
        if (row.file_path) {
          const signed = await supabase.storage.from(bucket).createSignedUrl(row.file_path, 60 * 60)
          if (!signed.error) downloadUrl = signed.data.signedUrl
        }
        return { ...row, downloadUrl }
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
