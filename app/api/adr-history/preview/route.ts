import { NextResponse, type NextRequest } from "next/server"
import JSZip from "jszip"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bucket = "adr-checklists"

function normalizePath(p?: string | null) {
  if (!p) return ""
  // Accept values like: "adr-checklists/reduced/abc.zip" or "reduced/abc.zip"
  return p.replace(/^\/+/, "").replace(/^adr-checklists\//, "")
}

async function downloadFirstAvailable(supabase: ReturnType<typeof getSupabaseAdmin>, paths: string[]) {
  for (const p of paths) {
    if (!p) continue
    const dl = await supabase.storage.from(bucket).download(p)
    if (!dl.error && dl.data) return { path: p, blob: dl.data as Blob }
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: row, error } = await supabase
      .from("adr_checklists")
      .select("id, checklist_type, checklist_hash, file_path")
      .eq("id", id)
      .single()

    if (error || !row) {
      return NextResponse.json({ success: false, message: error?.message || "Checklist not found" }, { status: 404 })
    }

    const type = row.checklist_type as "reduced" | "full"
    const hash = row.checklist_hash as string
    const storedPath = normalizePath(row.file_path as any)

    const candidates = Array.from(
      new Set([
        storedPath,
        `${type}/${hash}.zip`,
        // legacy
        type === "reduced" ? `under1000/${hash}.zip` : "",
        type === "reduced" ? `reduced/${hash}.zip` : "",
      ]),
    ).filter(Boolean)

    const found = await downloadFirstAvailable(supabase, candidates)
    if (!found) {
      return NextResponse.json(
        { success: false, message: `ZIP not found in storage. Tried: ${candidates.join(", ")}` },
        { status: 404 },
      )
    }

    const arrBuf = await found.blob.arrayBuffer()
    const zip = await JSZip.loadAsync(arrBuf)

    // Find a PDF inside the ZIP
    const pdfFile =
      Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".pdf")) ||
      Object.values(zip.files).find((f) => !f.dir)

    if (!pdfFile) {
      return NextResponse.json({ success: false, message: "No PDF found in ZIP" }, { status: 500 })
    }

    const pdfBytes = await pdfFile.async("uint8array")

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ADR.pdf"',
        "Cache-Control": "no-store",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Preview failed" }, { status: 500 })
  }
}
