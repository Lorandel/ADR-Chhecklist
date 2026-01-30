import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type IncomingPhoto = {
  url: string
  name?: string
  contentType?: string
}
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

const mapVariant = (v: unknown): "full" | "reduced" => (v === "full" ? "full" : "reduced")

export async function POST(req: NextRequest) {
  try {
    console.log("=== Email API Called ===")

    const body = await req.json()
    const {
      inspectorName,
      inspectorEmail,
      driverName,
      truckPlate,
      trailerPlate,
      inspectionDate,
      pdfBase64,
      remarks,
      photos,
      variant,
      checklistHash,
      meta,
    } = body as {
      inspectorName: string
      inspectorEmail?: string | string[]
      driverName: string
      truckPlate: string
      trailerPlate: string
      inspectionDate: string
      pdfBase64: string
      remarks?: string
      photos?: IncomingPhoto[]
      variant?: "full" | "under1000" | "reduced"
      checklistHash?: string
      meta?: Record<string, unknown>
    }

    console.log("Inspector:", inspectorName)
    console.log("Driver:", driverName)
    console.log("PDF size:", pdfBase64?.length || 0, "characters")

    // Validate required email environment variables
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("Missing email environment variables")
      return NextResponse.json(
        {
          success: false,
          message: "Email configuration missing",
          details: {
            hasGmailUser: !!process.env.GMAIL_USER,
            hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
          },
        },
        { status: 500 },
      )
    }

    if (!inspectorName || !pdfBase64) {
      console.error("Missing required data:", {
        hasInspectorName: !!inspectorName,
        hasPdfData: !!pdfBase64,
        pdfDataLength: pdfBase64?.length || 0,
      })
      return NextResponse.json(
        {
          success: false,
          message: "Missing inspector name or PDF data",
        },
        { status: 400 },
      )
    }

    const normalizeRecipientList = (v: unknown): string[] => {
      if (!v) return []
      if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
      if (typeof v === "string") {
        // allow comma/semicolon/space separated lists
        return v
          .split(/[;,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      }
      return []
    }

    const recipientsFromBody = normalizeRecipientList(inspectorEmail)
    const recipients = recipientsFromBody.length ? recipientsFromBody : inspectorEmails[inspectorName]

    if (!recipients || recipients.length === 0) {
      console.error("No recipients found for inspector:", inspectorName)
      return NextResponse.json(
        {
          success: false,
          message: "No email recipients found for this inspector",
        },
        { status: 400 },
      )
    }

    // Convert base64 to buffer
    let pdfBuffer: Buffer
    try {
      const cleanedBase64 = typeof pdfBase64 === "string" ? pdfBase64.replace(/^data:application\/pdf;base64,/, "") : ""
      pdfBuffer = Buffer.from(cleanedBase64, "base64")
      console.log("PDF buffer size:", pdfBuffer.length, "bytes")

      if (pdfBuffer.length === 0) {
        throw new Error("PDF buffer is empty")
      }

      // Validate that it's actually a PDF
      if (!pdfBuffer.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
        console.warn("Warning: Buffer doesn't start with PDF signature")
      }
    } catch (bufferError) {
      console.error("PDF buffer processing error:", bufferError)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to process PDF data",
          error: bufferError.message,
        },
        { status: 500 },
      )
    }

    // Create ZIP (PDF + photos)
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    const pdfInZipName = `ADR-Checklist_${driverName.replace(/\s+/g, "_")}_${inspectionDate.replace(/-/g, ".")}.pdf`
    zip.file(pdfInZipName, pdfBuffer)

    const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_")

    const photoList: IncomingPhoto[] = Array.isArray(photos) ? photos : []
    for (let i = 0; i < photoList.length; i++) {
      const photo = photoList[i]
      if (!photo?.url) continue
      try {
        const resp = await fetch(photo.url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const arrBuf = await resp.arrayBuffer()
        const buf = Buffer.from(arrBuf)
        if (buf.length === 0) throw new Error("Empty photo buffer")
        const original = safeFileName(photo.name || `photo_${i + 1}.jpg`)
        zip.file(`photos/${String(i + 1).padStart(2, "0")}_${original}`, buf)
      } catch (e: any) {
        console.error(`❌ Failed to add photo #${i + 1} to ZIP:`, e?.message)
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    // Store ZIP in Supabase (dedupe by checklistHash)
    let storedUrl: string | null = null
    try {
      const hash = (checklistHash || "").trim()
      if (hash) {
        const supabase = getSupabaseAdmin()
        const checklistType = mapVariant(variant)
        const bucket = "adr-checklists"
        const objectPath = `${checklistType}/${hash}.zip`

        const existing = await supabase
          .from("adr_checklists")
          .select("id")
          .eq("checklist_hash", hash)
          .maybeSingle()

        const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

        if (!existing.data) {
          const up = await supabase.storage.from(bucket).upload(objectPath, zipBuffer, {
            contentType: "application/zip",
            upsert: false,
          })

          if (!up.error) {
            await supabase.from("adr_checklists").insert({
              checklist_type: checklistType,
              checklist_hash: hash,
              file_path: objectPath,
              expires_at: expiresAt,
              email_sent: true,
              meta: meta ?? null,
            })
          }
        } else {
          const updatePayload: Record<string, unknown> = { email_sent: true, expires_at: expiresAt }
          if (meta) updatePayload.meta = meta
          await supabase.from("adr_checklists").update(updatePayload).eq("checklist_hash", hash)
        }

        const signed = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60)
        if (!signed.error) storedUrl = signed.data.signedUrl
      }
    } catch (e: any) {
      console.error("Supabase store failed:", e?.message)
    }

    // Dynamic import for nodemailer (interop safe)
    const nodemailerMod: any = await import("nodemailer")
    const nodemailer = nodemailerMod?.default ?? nodemailerMod

    console.log("Creating email transporter...")
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })


    // Verify transporter configuration
    console.log("Verifying email configuration...")
    try {
      await transporter.verify()
      console.log("✓ Email transporter verified")
    } catch (verifyError) {
      console.error("Email verification failed:", verifyError)
      return NextResponse.json(
        {
          success: false,
          message: "Email configuration is invalid",
          details: verifyError.message,
        },
        { status: 500 },
      )
    }

    // Email options
    const mailOptions = {
      from: `"ADR Checklist System" <${process.env.GMAIL_USER}>`,
      to: recipients.join(", "),
      subject: `ADR Checklist - ${driverName} (${truckPlate}/${trailerPlate})`,
      text: `Please find attached the ADR Checklist for:

Driver: ${driverName}
Truck: ${truckPlate}
Trailer: ${trailerPlate}
Inspection Date: ${inspectionDate}
Inspector: ${inspectorName}

Remarks: ${typeof remarks === "string" && remarks.trim() ? remarks.trim() : "-"}

Photos: ${(Array.isArray(photos) ? photos.length : 0) || 0}

${storedUrl ? `The document is also available online (valid 1 hour): ${storedUrl}` : ""}

This checklist was generated automatically by the ADR Checklist System.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">ADR Checklist Report</h2>
          <p>Please find attached the ADR Checklist with the following details:</p>
          
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Driver:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${driverName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Truck:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${truckPlate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Trailer:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${trailerPlate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Inspection Date:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${inspectionDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Inspector:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${inspectorName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Remarks:</td>
              <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${typeof remarks === "string" && remarks.trim() ? remarks.trim() : "-"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Photos:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${(Array.isArray(photos) ? photos.length : 0) || 0}</td>
            </tr>
          </table>
          
          ${storedUrl ? `<p><strong>Online Access (valid 1 hour):</strong> <a href="${storedUrl}" target="_blank" style="color: #0066cc;">Download ZIP</a></p>` : ""}
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This email was generated automatically by the ADR Checklist System.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `ADR-Check_${driverName.replace(/\s+/g, "_")}_${inspectionDate.replace(/-/g, ".")}.zip`,
          content: zipBuffer,
          contentType: "application/zip",
        },
      ],
    }

    // Send email
    console.log("Sending email to:", recipients.join(", "))
    try {
      const emailResult = await transporter.sendMail(mailOptions)
      console.log("✓ Email sent successfully")
      console.log("Message ID:", emailResult.messageId)

      // Prepare response message
      let message = `Email sent successfully to ${recipients.length} recipient(s)`
      if (storedUrl) message += " and saved to Supabase (ZIP)"

      return NextResponse.json({
        success: true,
        message: message,
        storedUrl,
        emailMessageId: emailResult.messageId,
      })
    } catch (sendError) {
      console.error("Email sending failed:", sendError)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to send email",
          error: sendError.message,
          details: {
            code: sendError.code,
            command: sendError.command,
            response: sendError.response,
          },
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("❌ Email API error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send email. Please try again.",
        error: error.message,
        details: {
          code: error.code,
          command: error.command,
          response: error.response,
        },
      },
      { status: 500 },
    )
  }
}
