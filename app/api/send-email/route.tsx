import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

type Meta = Record<string, any>

const escapeHtml = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

const safeMeta = (meta: any): Meta => {
  if (!meta) return {}
  if (typeof meta === "object") return meta
  if (typeof meta === "string") {
    try {
      const parsed = JSON.parse(meta)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

const pick = (meta: Meta, keys: string[], fallback?: any) => {
  for (const k of keys) {
    if (meta[k] !== undefined && meta[k] !== null && String(meta[k]).trim() !== "") return meta[k]
  }
  return fallback
}

const formatDDMMYYYY = (iso: string) => {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())
  return `${dd}-${mm}-${yyyy}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // We accept both the new small payload and the legacy fields (for backward compatibility)
    const to = String(body?.to || body?.email || "").trim()
    const id = String(body?.id || "").trim()

    if (!to) {
      return NextResponse.json({ success: false, message: "Missing recipient email (to)." }, { status: 400 })
    }
    if (!id) {
      return NextResponse.json({ success: false, message: "Missing checklist id." }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { success: false, message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server." },
        { status: 500 },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    })

    const { data: row, error } = await supabase
      .from("adr_checklists")
      .select("id, file_path, created_at, meta")
      .eq("id", id)
      .single()

    if (error || !row?.file_path) {
      return NextResponse.json(
        { success: false, message: error?.message || "Checklist not found." },
        { status: 404 },
      )
    }

    const meta = safeMeta(row.meta)

    const driverName = String(pick(meta, ["driverName", "driver_name"], body?.driverName || "")).trim()
    const inspectorName = String(pick(meta, ["inspectorName", "inspector_name"], body?.inspectorName || "")).trim()
    const truckPlate = String(pick(meta, ["truckPlate", "truck_plate"], body?.truckPlate || "")).trim()
    const trailerPlate = String(pick(meta, ["trailerPlate", "trailer_plate"], body?.trailerPlate || "")).trim()
    const inspectionDateRaw = String(
      pick(meta, ["inspectionDate", "inspection_date"], body?.inspectionDate || ""),
    ).trim()
    const inspectionDate = inspectionDateRaw || (row.created_at ? formatDDMMYYYY(row.created_at) : "")
    const remarks = String(pick(meta, ["remarks"], body?.remarks || "-") ?? "-")
    const photosCount = Number(pick(meta, ["photosCount", "photos_count"], body?.photosCount || body?.photos?.length || 0))

    const bucket = "adr-checklists"
    const filePath = String(row.file_path)

    // Signed URL valid 1 hour (also used in email "Online Access")
    const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60)
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { success: false, message: signErr?.message || "Failed to create signed URL." },
        { status: 500 },
      )
    }

    // Download ZIP bytes server-side (avoids Vercel payload limit 413)
    const dlRes = await fetch(signed.signedUrl)
    if (!dlRes.ok) {
      return NextResponse.json(
        { success: false, message: `Failed to download ZIP from storage (${dlRes.status}).` },
        { status: 500 },
      )
    }
    const ab = await dlRes.arrayBuffer()
    const zipBuffer = Buffer.from(ab)

    // Mail transport (Gmail App Password)
    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD
    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { success: false, message: "Missing GMAIL_USER or GMAIL_APP_PASSWORD on server." },
        { status: 500 },
      )
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    })

    // Match the previous sender display name
    const from = `"ADR Check system" <${gmailUser}>`

    const subject = "ADR Checklist Report"

    // Match the previous HTML structure (table layout + online access line)
    const html = `
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"><div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">ADR Checklist Report</h2>
  <p>Please find attached the ADR Checklist with the following details:</p>

  <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Driver:</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(driverName)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Truck:</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(truckPlate)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Trailer:</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(trailerPlate)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Inspection Date:</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(inspectionDate)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Inspector:</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(inspectorName)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Remarks:</td>
      <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${escapeHtml(remarks || "-")}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Photos:</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${Number.isFinite(photosCount) ? photosCount : 0}</td>
    </tr>
  </table>

  <p><strong>Online Access (valid 1 hour):</strong> <a href="${escapeHtml(signed.signedUrl)}">${escapeHtml(
    signed.signedUrl,
  )}</a></p>

  <p style="margin-top: 18px;">The ZIP file (PDF + photos) is attached to this email.</p>

  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    This email was generated automatically by ADR Check system.
  </p>
</div>
`

    // Attachment name similar to previous
    const niceNameParts = [
      "ADR Checklist",
      driverName ? `- ${driverName}` : "",
      inspectionDate ? `- ${inspectionDate}` : "",
    ].filter(Boolean)
    const attachmentName = `${niceNameParts.join(" ").replace(/\s+/g, " ").trim()}.zip`

    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: `ADR Checklist Report\nDriver: ${driverName}\nInspector: ${inspectorName}\nDate: ${inspectionDate}\nTruck: ${truckPlate}\nTrailer: ${trailerPlate}\nRemarks: ${remarks}\nPhotos: ${photosCount}\n\nOnline Access (valid 1 hour): ${signed.signedUrl}\n\nThe ZIP file (PDF + photos) is attached.`,
      attachments: [
        {
          filename: attachmentName,
          content: zipBuffer,
          contentType: "application/zip",
        },
      ],
    })

    // Mark emailed (best-effort)
    await supabase.from("adr_checklists").update({ email_sent: true }).eq("id", id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to send email" }, { status: 500 })
  }
}
