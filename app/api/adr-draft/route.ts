import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

type ChecklistVariant = "full" | "under1000"

function getBearerToken(req: NextRequest): string {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ""
}

function asVariant(v: unknown): ChecklistVariant | null {
  return v === "full" || v === "under1000" ? v : null
}

function draftPath(variant: ChecklistVariant) {
  return `drafts/${variant}.json`
}

async function assertAuthenticated(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return { ok: false as const, status: 401, message: "Missing token" }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return { ok: false as const, status: 401, message: error?.message || "Invalid token" }
  }

  return { ok: true as const, supabase, user: data.user }
}

export async function GET(req: NextRequest) {
  const auth = await assertAuthenticated(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status })

  const variant = asVariant(req.nextUrl.searchParams.get("variant"))
  if (!variant) return NextResponse.json({ success: false, message: "Missing or invalid variant" }, { status: 400 })

  try {
    const download = await auth.supabase.storage.from("adr-checklists").download(draftPath(variant))
    if (download.error || !download.data) {
      const msg = String(download.error?.message || "").toLowerCase()
      if (msg.includes("not found") || msg.includes("404") || msg.includes("does not exist")) {
        return NextResponse.json({ success: true, draft: null })
      }
      return NextResponse.json({ success: false, message: download.error?.message || "Failed to load draft" }, { status: 500 })
    }

    const text = await download.data.text()
    const draft = JSON.parse(text)
    return NextResponse.json({ success: true, draft })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to load draft" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status })

  try {
    const body = await req.json()
    const variant = asVariant(body?.variant)
    if (!variant) return NextResponse.json({ success: false, message: "Missing or invalid variant" }, { status: 400 })

    const meta: any = auth.user.user_metadata || {}
    const payload = {
      variant,
      updatedAt: new Date().toISOString(),
      ownerUserId: auth.user.id,
      inspectorName: typeof meta.inspectorName === "string" && meta.inspectorName.trim() ? meta.inspectorName.trim() : auth.user.email || "Unknown inspector",
      data: body?.data || {},
    }

    const json = JSON.stringify(payload)
    const up = await auth.supabase.storage.from("adr-checklists").upload(draftPath(variant), Buffer.from(json, "utf8"), {
      contentType: "application/json",
      upsert: true,
    })

    if (up.error) return NextResponse.json({ success: false, message: up.error.message }, { status: 500 })
    return NextResponse.json({ success: true, draft: payload })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to save draft" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await assertAuthenticated(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const variant = asVariant(body?.variant || req.nextUrl.searchParams.get("variant"))
    if (!variant) return NextResponse.json({ success: false, message: "Missing or invalid variant" }, { status: 400 })

    const del = await auth.supabase.storage.from("adr-checklists").remove([draftPath(variant)])
    if (del.error) return NextResponse.json({ success: false, message: del.error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to delete draft" }, { status: 500 })
  }
}
