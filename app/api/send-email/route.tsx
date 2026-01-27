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

export async function POST(req: NextRequest) {
  try {
    console.log("=== Email API Called ===")
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
      return NextResponse.json({ success: false, message: `No email found for inspector: ${inspectorName}` }, { status: 400 })
    }

    // Download the ZIP from Supabase Storage (avoid sending large payload through Vercel)
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
      console.error("Storage download failed:", dl.error?.message)
      return NextResponse.json(
        { success: false, message: dl.error?.message || "Failed to download ZIP from storage" },
        { status: 500 },
      )
    }

    const arrBuf = await dl.data.arrayBuffer()
    const zipBuffer = Buffer.from(arrBuf)

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

    console.log("Creating email transporter...")
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })

    const safe = (s: string) => (s || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_")
    const zipFilename = `ADR-Check_${safe(driverName)}_${safe(inspectionDate).replace(/-/g, ".")}.zip`

    const subject = `ADR Checklist - ${driverName} - ${inspectionDate}`

    const mailOptions = {
      from: gmailUser,
      to: recipients.join(", "),
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">ADR Checklist Completed</h2>
          <p><strong>Driver:</strong> ${driverName}</p>
          <p><strong>Inspector:</strong> ${inspectorName}</p>
          <p><strong>Date:</strong> ${inspectionDate}</p>
          <p><strong>Truck Plate:</strong> ${truckPlate || "-"}</p>
          <p><strong>Trailer Plate:</strong> ${trailerPlate || "-"}</p>
          ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ""}

          <p style="margin-top: 18px;">The ZIP file (PDF + photos) is attached to this email.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This email was generated automatically by the ADR Checklist System.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: zipFilename,
          content: zipBuffer,
          contentType: "application/zip",
        },
      ],
    }

    console.log("Sending email to:", recipients.join(", "))
    const emailResult = await transporter.sendMail(mailOptions)
    console.log("✓ Email sent successfully")
    console.log("Message ID:", emailResult.messageId)

    return NextResponse.json({ success: true, message: "Email sent successfully" })
  } catch (error: any) {
    console.error("Email API error:", error)
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to send email" },
      { status: 500 },
    )
  }
}
