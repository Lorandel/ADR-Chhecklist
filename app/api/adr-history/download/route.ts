import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const bucket = "adr-checklists"

function normalizePath(p?: string | null) {
  if (!p) return ""
  return p.replace(/^\/+/, "").replace(/^adr-checklists\//, "")
}

async function signedUrlForFirstAvailable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  paths: string[],
): Promise<string | null> {
  for (const p of paths) {
    if (!p) continue
    const signed = await supabase.storage.from(bucket).createSignedUrl(p, 60 * 10) // 10 minutes
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl
  }
  return null
}

function safeMeta(meta: any): Record<string, any> {
  if (!meta) return {}
  if (typeof meta === "object") return meta as Record<string, any>
  if (typeof meta === "string") {
    try {
      const parsed = JSON.parse(meta)
      return parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {}
    } catch {
      return {}
    }
  }
  return {}
}

function ymdFromDate(d: Date) {
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function sanitizeForFilename(s: string) {
  return (s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function buildZipName(row: any) {
  const m = safeMeta(row?.meta)
  const driver = String(m.driverName ?? m.driver_name ?? "").trim()
  let date = String(m.inspectionDate ?? m.inspection_date ?? "").trim()

  if (!date) {
    const created = row?.created_at ? new Date(row.created_at) : new Date()
    date = ymdFromDate(created)
  }

  const driverPart = sanitizeForFilename(driver) || String(row?.checklist_hash || "ADR").slice(0, 10)
  const datePart = String(date).replace(/-/g, ".")
  return `ADR-Check_${driverPart}_${datePart}.zip`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const rowRes = await supabase
      .from("adr_checklists")
      .select("id, checklist_type, checklist_hash, file_path, created_at, meta")
      .eq("id", id)
      .maybeSingle()

    if (rowRes.error) {
      return NextResponse.json({ success: false, message: rowRes.error.message }, { status: 500 })
    }
    if (!rowRes.data) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })
    }

    const row: any = rowRes.data
    const t = row.checklist_type as "reduced" | "full"
    const hash = row.checklist_hash as string
    const stored = normalizePath(row.file_path as any)

    const candidates = Array.from(
      new Set([
        stored,
        `${t}/${hash}.zip`,
        // legacy reduced path
        t === "reduced" ? `under1000/${hash}.zip` : "",
      ]),
    ).filter(Boolean) as string[]

    const signedUrl = await signedUrlForFirstAvailable(supabase, candidates)
    if (!signedUrl) {
      return NextResponse.json({ success: false, message: "File not available" }, { status: 404 })
    }

    const upstream = await fetch(signedUrl, { cache: "no-store" })
    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "")
      return NextResponse.json(
        { success: false, message: t || `Download failed (${upstream.status})` },
        { status: 502 },
      )
    }

    const filename = buildZipName(row)

    const headers = new Headers()
    headers.set("Content-Type", "application/zip")
    headers.set("Content-Disposition", `attachment; filename="${filename}"`)
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

    return new NextResponse(upstream.body, { status: 200, headers })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Download failed" }, { status: 500 })
  }
}
