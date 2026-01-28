import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import JSZip from "jszip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const normalizePath = (p: any): string => {
  const s = (p || "").toString().trim()
  if (!s) return ""
  const noLeading = s.replace(/^\//, "")
  return noLeading.replace(/^adr-checklists\//i, "")
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const id = (searchParams.get("id") || "").trim()

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 })
    }

    const rowRes = await supabase
      .from("adr_checklists")
      .select("id, file_path")
      .eq("id", id)
      .maybeSingle()

    if (rowRes.error) {
      return NextResponse.json({ success: false, message: rowRes.error.message }, { status: 500 })
    }
    if (!rowRes.data?.file_path) {
      return NextResponse.json({ success: false, message: "Checklist not found" }, { status: 404 })
    }

    const bucket = "adr-checklists"
    const fp = normalizePath(rowRes.data.file_path)

    const dl = await supabase.storage.from(bucket).download(fp)
    if (dl.error || !dl.data) {
      return NextResponse.json(
        { success: false, message: dl.error?.message || "Failed to download ZIP from storage" },
        { status: 500 },
      )
    }

    const zipBuffer = Buffer.from(await dl.data.arrayBuffer())

    // Extract PDF from ZIP
    const zip = await JSZip.loadAsync(zipBuffer)
    const pdfEntry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".pdf"))

    if (!pdfEntry) {
      return NextResponse.json({ success: false, message: "No PDF found in ZIP" }, { status: 500 })
    }

    const pdfBuf = Buffer.from(await pdfEntry.async("arraybuffer"))

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=ADR-Checklist.pdf",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    })
  } catch (e: any) {
    const msg = typeof e?.message === "string" && e.message.trim() ? e.message : "Failed to preview PDF"
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
