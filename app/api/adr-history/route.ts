import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
// IMPORTANT: This endpoint must never be cached (Vercel/Next can cache GET route handlers).
export const dynamic = "force-dynamic"
export const revalidate = 0

type Row = {
  id: string
  checklist_type: "reduced" | "full"
  checklist_hash: string
  file_path: string | null
  created_at: string
  expires_at: string
  email_sent: boolean
  meta: any
}

const BUCKET = "adr-checklists"

function normalizePath(p: string) {
  let s = (p || "").trim()
  s = s.replace(/^\//, "")
  // Sometimes file_path might be stored as "adr-checklists/reduced/xxx.zip"
  if (s.startsWith(BUCKET + "/")) s = s.slice((BUCKET + "/").length)
  // Sometimes stored as "public/adr-checklists/..."
  if (s.startsWith("public/" + BUCKET + "/")) s = s.slice(("public/" + BUCKET + "/").length)
  return s
}

function candidatePaths(row: Row): string[] {
  const out: string[] = []
  if (row.file_path) out.push(normalizePath(row.file_path))
  // Fallbacks (for older rows)
  if (row.checklist_hash) {
    if (row.checklist_type === "full") {
      out.push(`full/${row.checklist_hash}.zip`)
    } else {
      out.push(`reduced/${row.checklist_hash}.zip`)
      // historical variant name
      out.push(`under1000/${row.checklist_hash}.zip`)
    }
  }
  // De-dupe
  return Array.from(new Set(out.filter(Boolean)))
}

async function firstSignedUrl(supabase: any, paths: string[]) {
  for (const p of paths) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(p, 60 * 60)
    if (!signed.error && signed.data?.signedUrl) return { url: signed.data.signedUrl, path: p }
  }
  return { url: null as string | null, path: null as string | null }
}

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

    const rows = (Array.isArray(res.data) ? res.data : []) as Row[]

    const items = await Promise.all(
      rows.map(async (row) => {
        const candidates = candidatePaths(row)
        const signed = await firstSignedUrl(supabase, candidates)
        // Return normalized path for preview/download debugging too
        return { ...row, file_path: candidates[0] ?? row.file_path, downloadUrl: signed.url }
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
