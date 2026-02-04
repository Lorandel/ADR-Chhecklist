import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

const mapVariant = (v: unknown): "full" | "reduced" => (v === "full" ? "full" : "reduced")

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { checklistHash, variant } = body as { checklistHash?: string; variant?: unknown }

    const hash = (checklistHash || "").trim()
    if (!hash) {
      return NextResponse.json({ success: false, message: "Missing checklistHash" }, { status: 400 })
    }

    const checklistType = mapVariant(variant)
    const bucket = "adr-checklists"
    // Temporary object for client upload; removed by /api/send-email after processing.
    const path = `tmp-pdf/${checklistType}/${hash}.pdf`

    const supabase = getSupabaseAdmin()

    // supabase-js v2 exposes createSignedUploadUrl + uploadToSignedUrl.
    // We keep 'any' to avoid type mismatches across versions.
    const anyStorage: any = supabase.storage.from(bucket)
    if (typeof anyStorage.createSignedUploadUrl !== "function") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supabase storage signed upload is not available in this build. Update @supabase/supabase-js to v2.x with createSignedUploadUrl.",
        },
        { status: 500 },
      )
    }

    const { data, error } = await anyStorage.createSignedUploadUrl(path)
    if (error || !data) {
      return NextResponse.json(
        { success: false, message: "Failed to create signed upload URL", error: error?.message || String(error) },
        { status: 500 },
      )
    }

    // data typically includes { signedUrl, path, token }.
    return NextResponse.json({
      success: true,
      bucket,
      path: data.path || path,
      token: data.token,
      signedUrl: data.signedUrl,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to presign upload" }, { status: 500 })
  }
}
