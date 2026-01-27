import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

const inspectorEmails: Record<string, string[]> = {
  "Eduard Tudose": ["eduard.tudose@alblas.nl"],
  "Angela Ilis": ["angela.ilis@alblas.nl"],
  "Lucian Sistac": ["lucian.sistac@alblas.nl"],
  "Robert Kerekes": ["robert.kerekes@alblas.nl"],
  "Alexandru Dogariu": ["alexandru.dogariu@alblas.nl"],
  "Martian Gherasim": ["martian-george.gherasim@alblas.nl"],
  "Alexandru Florea": [
    "eduard.tudose@alblas.nl",
    "angela.ilis@alblas.nl",
    "lucian.sistac@alblas.nl",
    "robert.kerekes@alblas.nl",
    "alexandru.dogariu@alblas.nl",
    "martian-george.gherasim@alblas.nl",
  ],
}

type Body = {
  inspectorName: string
  driverName: string
  truckPlate: string
  trailerPlate: string
  inspectionDate: string
  remarks?: string
  variant: "full" | "under1000" | "reduced"
  checklistHash: string
  meta?: Record<string, unknown> | null
}

const mapVariant = (v: Body["variant"]): "full" | "reduced" => (v === "full" ? "full" : "reduced")

const escapeHtml = (s: string) =>
  (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Body>

    const inspectorName = (body.inspectorName || "").trim()
    const driverName = (body.driverName || "").trim()
    const truckPlate = (body.truckPlate || "").trim()
    const trailerPlate = (body.trailerPlate || "").trim()
    const inspectionDate = (body.inspectionDate || "").trim()
    const remarks = (body.remarks || "").toString()
    const variant = (body.variant || "reduced") as Body["variant"]
    const checklistHash = (body.checklistHash || "").trim()
    const meta = (body.meta ?? null) as Record<string, unknown> | null

    if (!inspectorName) {
      return NextResponse.json({ success: false, message: "Missing inspectorName" }, { status: 400 })
    }
    if (!driverName) {
      return NextResponse.json({ success: false, message: "Missing driverName" }, { status: 400 })
    }
    if (!inspectionDate) {
      return NextResponse.json({ success: false, message: "Missing inspectionDate" }, { status: 400 })
    }
    if (!checklistHash) {
      return NextResponse.json({ success: false, message: "Missing checklistHash" }, { status: 400 })
    }

    const recipients = inspectorEmails[inspectorName]
    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { success: false, message: `No email found for inspector: ${inspectorName}` },
        { status: 400 },
      )
    }

    // Download ZIP from Supabase Storage (avoid sending large payload through Vercel)
    const checklistType = mapVariant(variant)
    const bucket = "adr-checklists"
    const objectPath = `${checklistType}/${checklistHash}.zip`

    const supabase = getSupabaseAdmin()

    // Keep DB in sync: mark emailed + refresh retention
    try {
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
      const updatePayload: Record<string, unknown> = { email_sent: true, expires_at: expiresAt }
      if (meta) updatePayload.meta = meta
      await supabase.from("adr_checklists").update(updatePayload).eq("checklist_hash", checklistHash)
    } catch (e: any) {
      console.warn("DB update (email_sent) failed:", e?.message)
    }

    const dl = await supabase.storage.from(bucket).download(objectPath)
    if (dl.error || !dl.data) {
      return NextResponse.json(
        { success: false, message: dl.error?.message || "Failed to download ZIP from storage" },
        { status: 500 },
      )
    }

    const arrBuf = await dl.data.arrayBuffer()
    const zipBuffer = Buffer.from(arrBuf)

    // Optional: generate a 1 hour signed URL for online access (same as old email)
    let signedUrl: string | null = null
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60)
      if (!error && data?.signedUrl) signedUrl = data.signedUrl
    } catch {
      signedUrl = null
    }

    // Dynamic import for nodemailer (interop safe)
    const nodemailerMod: any = await import("nodemailer")
    const nodemailer = nodemailerMod?.default ?? nodemailerMod

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { success: false, message: "Missing GMAIL_USER or GMAIL_APP_PASSWORD env vars on server" },
        { status: 500 },
      )
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    })

    const safe = (s: string) => (s || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_")
    const zipFilename = `ADR-Checklist_${safe(driverName)}_${safe(inspectionDate).replace(/-/g, ".")}.zip`

    // Keep subject similar to old
    const subject = "ADR Checklist Report"

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 780px; margin: 0 auto; color: #111827;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
          <div>
            <div style="font-size: 18px; font-weight: 700; margin: 0;">ADR Checklist Report</div>
            <div style="font-size: 12px; color:#6b7280; margin-top:4px;">
              Generated by ADR Check system
            </div>
          </div>
        </div>

        <div style="margin-top:16px; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse;">
            <tbody>
              <tr>
                <td style="padding:10px 12px; background:#f9fafb; width:200px; font-weight:600; border-bottom:1px solid #e5e7eb;">Driver</td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(driverName)}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px; background:#f9fafb; font-weight:600; border-bottom:1px solid #e5e7eb;">Inspector</td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(inspectorName)}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px; background:#f9fafb; font-weight:600; border-bottom:1px solid #e5e7eb;">Date</td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(inspectionDate)}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px; background:#f9fafb; font-weight:600; border-bottom:1px solid #e5e7eb;">Truck plate</td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(truckPlate || "-")}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px; background:#f9fafb; font-weight:600; border-bottom:1px solid #e5e7eb;">Trailer plate</td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(trailerPlate || "-")}</td>
              </tr>
              ${
                remarks
                  ? `<tr>
                      <td style="padding:10px 12px; background:#f9fafb; font-weight:600; border-bottom:1px solid #e5e7eb;">Remarks</td>
                      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb;">${escapeHtml(remarks)}</td>
                    </tr>`
                  : ""
              }
            </tbody>
          </table>
        </div>

        <div style="margin-top:14px; font-size:13px; color:#111827;">
          The ZIP file (PDF + photos) is attached to this email.
        </div>

        ${
  signedUrl
    ? `<div style="margin-top:10px; padding:12px; border:1px dashed #e5e7eb; border-radius:12px; background:#fafafa;">
         <div style="font-size: 13px; font-weight:700; margin-bottom:6px;">Online Access (valid 1 hour)</div>
         <a href="${signedUrl}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#ffffff; text-decoration:none; font-weight:700;">
           Download ZIP
         </a>
       </div>`
    : ""
}


        <div style="margin-top:18px; font-size:12px; color:#6b7280;">
          This email was generated automatically by the ADR Check system.
        </div>
      </div>
    `

    const mailOptions = {
      // Display name as before; mailbox is Gmail
      from: `"ADR Check system" <${gmailUser}>`,
      to: recipients.join(", "),
      subject,
      html,
      attachments: [
        {
          filename: zipFilename,
          content: zipBuffer,
          contentType: "application/zip",
        },
      ],
    }

    await transporter.sendMail(mailOptions)

    return NextResponse.json({ success: true, message: "Email sent successfully" })
  } catch (error: any) {
    console.error("Email API error:", error)
    return NextResponse.json({ success: false, message: error?.message || "Failed to send email" }, { status: 500 })
  }
}
