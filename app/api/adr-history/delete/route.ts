import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function getBearerToken(req: NextRequest): string {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ""
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = getBearerToken(req)
  if (!token) return false
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return false
  return (data.user.user_metadata as any)?.role === "admin"
}

type DeleteBody = {
  id: string
}

export async function POST(req: NextRequest) {
  try {
    const ok = await isAdmin(req)
    if (!ok) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as DeleteBody
    const id = (body.id || "").trim()
    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const row = await supabase.from("adr_checklists").select("file_path").eq("id", id).maybeSingle()
    if (row.error) {
      return NextResponse.json({ success: false, message: row.error.message }, { status: 500 })
    }
    if (!row.data) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })
    }

    const bucket = "adr-checklists"
    if (row.data.file_path) {
      await supabase.storage.from(bucket).remove([row.data.file_path])
    }

    const del = await supabase.from("adr_checklists").delete().eq("id", id)
    if (del.error) {
      return NextResponse.json({ success: false, message: del.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Failed to delete checklist", error: error?.message },
      { status: 500 },
    )
  }
}
