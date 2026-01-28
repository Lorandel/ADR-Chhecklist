import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import JSZip from "jszip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const id = (searchParams.get("id") || "").trim()
    const hash = (searchParams.get("hash") || "").trim()

    if (!id && !hash) {
      return NextResponse.json({ success: false, message: "Missing id or hash" }, { status: 400 })
    }

    const q = supabase
      .from("adr_checklists")
      .select("id, checklist_hash, file_path")
      .limit(1)

    const res = id ? await q.eq("id", id).maybeSingle() : await q.eq("checklist_hash", hash).maybeSingle()
    if (res.error) {
      return NextResponse.json({ success: false, message: res.error.message }, { status: 500 })
    }
    if (!res.data?.file_path) {
      return NextResponse.json({ success: false, message: "Checklist not found" }, { status: 404 })
    }

    const bucket = "adr-checklists"
    const dl = await supabase.storage.from(bucket).download(res.data.file_path)
    if (dl.error || !dl.data) {
      return NextResponse.json(
        { success: false, message: dl.error?.message || "Failed to download ZIP from storage" },
        { status: 500 },
      )
    }

    const zipBuf = Buffer.from(await dl.data.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBuf)

    // Find first PDF in ZIP
    const pdfEntryName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".pdf"))
    if (!pdfEntryName) {
      return NextResponse.json({ success: false, message: "No PDF found inside ZIP" }, { status: 404 })
    }

    const pdfBuf = await zip.files[pdfEntryName]!.async("nodebuffer")

    const safeName = (res.data.checklist_hash || "adr").replace(/[^a-zA-Z0-9._-]/g, "_")
    const filename = `${safeName}.pdf`

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // inline so it renders in iframe/object
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to preview PDF" },
      { status: 500 },
    )
  }
}
