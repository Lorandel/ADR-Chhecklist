import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

type StoreBody = {
  variant: "full" | "under1000" | "reduced"
  checklistHash: string
  zipBase64: string // base64 without data: prefix
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
    if (!checklistHash || !body.zipBase64) {
      return NextResponse.json({ success: false, message: "Missing checklistHash or zip data" }, { status: 400 })
    }

    const checklistType = mapVariant(body.variant)
    const supabase = getSupabaseAdmin()

    // Check existing row
    const existing = await supabase
      .from("adr_checklists")
      .select("id, file_path, checklist_type")
      .eq("checklist_hash", checklistHash)
      .maybeSingle()

    if (existing.error) {
      return NextResponse.json({ success: false, message: existing.error.message }, { status: 500 })
    }

    const zipBuffer = Buffer.from(body.zipBase64, "base64")
    if (!zipBuffer || zipBuffer.length === 0) {
      return NextResponse.json({ success: false, message: "ZIP buffer is empty" }, { status: 400 })
    }

    const bucket = "adr-checklists"
    const objectPath = `${checklistType}/${checklistHash}.zip`

    // If it doesn't exist, upload + insert.
    if (!existing.data) {
      const upload = await supabase.storage.from(bucket).upload(objectPath, zipBuffer, {
        contentType: "application/zip",
        upsert: false,
      })

      if (upload.error) {
        return NextResponse.json({ success: false, message: upload.error.message }, { status: 500 })
      }

      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
      const ins = await supabase.from("adr_checklists").insert({
        checklist_type: checklistType,
        checklist_hash: checklistHash,
        file_path: objectPath,
        expires_at: expiresAt,
        email_sent: !!body.emailSent,
        meta: body.meta ?? null,
      })

      if (ins.error) {
        // Best-effort cleanup of uploaded object.
        await supabase.storage.from(bucket).remove([objectPath])
        return NextResponse.json({ success: false, message: ins.error.message }, { status: 500 })
      }
    } else {
      // Exists: update flags/meta + refresh expiry.
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
      const updatePayload: Record<string, unknown> = { expires_at: expiresAt }
      if (body.emailSent) updatePayload.email_sent = true
      if (body.meta) updatePayload.meta = body.meta

      const upd = await supabase.from("adr_checklists").update(updatePayload).eq("checklist_hash", checklistHash)

      if (upd.error) {
        return NextResponse.json({ success: false, message: upd.error.message }, { status: 500 })
      }
    }

    // Return a signed URL for immediate download/use.
    const signed = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60)
    if (signed.error) {
      return NextResponse.json({ success: true, downloadUrl: null })
    }

    return NextResponse.json({ success: true, downloadUrl: signed.data.signedUrl })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Failed to store checklist", error: error?.message },
      { status: 500 },
    )
  }
}
