import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const BUCKET = "adr-checklists"

function normalizePath(p: string) {
  let s = (p || "").trim()
  s = s.replace(/^\//, "")
  if (s.startsWith(BUCKET + "/")) s = s.slice((BUCKET + "/").length)
  if (s.startsWith("public/" + BUCKET + "/")) s = s.slice(("public/" + BUCKET + "/").length)
  return s
}

function candidatePaths(row: any): string[] {
  const out: string[] = []
  if (row?.file_path) out.push(normalizePath(row.file_path))
  if (row?.checklist_hash) {
    if (row?.checklist_type === "full") out.push(`full/${row.checklist_hash}.zip`)
    else {
      out.push(`reduced/${row.checklist_hash}.zip`)
      out.push(`under1000/${row.checklist_hash}.zip`)
    }
  }
  return Array.from(new Set(out.filter(Boolean)))
}

async function downloadFirstAvailable(supabase: any, paths: string[]) {
  for (const p of paths) {
    const dl = await supabase.storage.from(BUCKET).download(p)
    if (!dl.error && dl.data) return { blob: dl.data, path: p }
  }
  return { blob: null as any, path: null as string | null }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = (searchParams.get("id") || "").trim()
    if (!id) return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const rowRes = await supabase
      .from("adr_checklists")
      .select("id, checklist_type, checklist_hash, file_path")
      .eq("id", id)
      .maybeSingle()

    if (rowRes.error) return NextResponse.json({ success: false, message: rowRes.error.message }, { status: 500 })
    if (!rowRes.data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

    const paths = candidatePaths(rowRes.data)

    // Download ZIP from storage
    const dl = await downloadFirstAvailable(supabase, paths)
    if (!dl.blob) {
      return NextResponse.json({ success: false, message: "ZIP not found in storage for this entry." }, { status: 404 })
    }

    const arrBuf = await dl.blob.arrayBuffer()
    const zipBuffer = Buffer.from(arrBuf)

    // Load ZIP and extract first PDF
    const jszipMod: any = await import("jszip")
    const JSZip = jszipMod?.default ?? jszipMod
    const zip = await JSZip.loadAsync(zipBuffer)

    let pdfFileName: string | null = null
    for (const name of Object.keys(zip.files)) {
      if (/\.pdf$/i.test(name) && !zip.files[name].dir) {
        pdfFileName = name
        break
      }
    }

    if (!pdfFileName) {
      return NextResponse.json({ success: false, message: "No PDF found inside ZIP." }, { status: 500 })
    }

    const pdfBuf: Buffer = await zip.files[pdfFileName].async("nodebuffer")

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ADR-${rowRes.data.checklist_hash}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to preview PDF" }, { status: 500 })
  }
}
