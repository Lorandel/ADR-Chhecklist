import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

type StoreBody = {
  variant: "full" | "under1000" | "reduced"
  checklistHash: string
  meta?: Record<string, unknown>
  emailSent?: boolean
}

function mapVariant(v: StoreBody["variant"]): "full" | "reduced" {
  return v === "full" ? "full" : "reduced"
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StoreBody
    const checklistHash = (body.checklistHash || "").trim()
    if (!checklistHash) {
      return NextResponse.json({ success: false, message: "Missing checklistHash" }, { status: 400 })
    }

    const checklistType = mapVariant(body.variant)
    const bucket = "adr-checklists"
    const objectPath = `${checklistType}/${checklistHash}.zip`

    const supabase = getSupabaseAdmin()

    // Does the DB row already exist?
    const existing = await supabase
      .from("adr_checklists")
      .select("id")
      .eq("checklist_hash", checklistHash)
      .maybeSingle()

    if (existing.error) {
      return NextResponse.json({ success: false, message: existing.error.message }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

    if (!existing.data) {
      // Create DB row first (so hash is reserved / deduped).
      const ins = await supabase.from("adr_checklists").insert({
        checklist_type: checklistType,
        checklist_hash: checklistHash,
        file_path: objectPath,
        expires_at: expiresAt,
        email_sent: !!body.emailSent,
        // Table column is NOT NULL with default {}. Never insert null.
        meta: body.meta ?? {},
      })

      // If insert fails due to unique constraint race, treat as existing.
      if (ins.error && !/duplicate key|unique/i.test(ins.error.message)) {
        return NextResponse.json({ success: false, message: ins.error.message }, { status: 500 })
      }

      // Ask Supabase Storage for a signed upload URL.
      const signedUp = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath)
      if (signedUp.error || !signedUp.data) {
        return NextResponse.json(
          { success: false, message: signedUp.error?.message || "Failed to create signed upload url" },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        upload: true,
        path: objectPath,
        token: signedUp.data.token,
      })
    }

    // Row exists: just refresh expiry / flags.
    const updatePayload: Record<string, unknown> = { expires_at: expiresAt }
    if (body.emailSent) updatePayload.email_sent = true
    if (body.meta) updatePayload.meta = body.meta

    const upd = await supabase.from("adr_checklists").update(updatePayload).eq("checklist_hash", checklistHash)
    if (upd.error) {
      return NextResponse.json({ success: false, message: upd.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, upload: false })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Failed to prepare checklist storage", error: error?.message },
      { status: 500 },
    )
  }
}
