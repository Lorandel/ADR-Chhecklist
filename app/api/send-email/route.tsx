import { type NextRequest, NextResponse } from "next/server"
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

// Function to upload PDF to Vercel Blob Storage
const uploadToVercelBlob = async (
  pdfBuffer: Buffer,
  fileName: string,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log("=== Starting Vercel Blob Upload ===")
    console.log("File name:", fileName)
    console.log("File size:", pdfBuffer.length, "bytes")

    // Import Vercel Blob
    const { put } = await import("@vercel/blob")

    // Upload to Vercel Blob
    const blob = await put(fileName, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    })

    console.log("✓ Vercel Blob upload successful")
    console.log("Blob URL:", blob.url)

    return {
      success: true,
      url: blob.url,
    }
  } catch (error: any) {
    console.error("❌ Vercel Blob upload failed:", error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== Email API Called ===")

    const body = await req.json()
    const { inspectorName, driverName, truckPlate, trailerPlate, inspectionDate, pdfBase64, remarks, photos } = body

    console.log("Inspector:", inspectorName)
    console.log("Driver:", driverName)
    console.log("PDF size:", pdfBase64?.length || 0, "characters")
    console.log("Remarks length:", (remarks || "").length)
    console.log("Photos count:", Array.isArray(photos) ? photos.length : 0)

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

    const recipients = inspectorEmails[inspectorName]
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
      pdfBuffer = Buffer.from(pdfBase64, "base64")
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


// Process photo attachments (optional)
type IncomingPhoto = { name?: string; type?: string; dataUrl?: string }
const photoBuffers: { filename: string; content: Buffer; contentType: string }[] = []
try {
  if (Array.isArray(photos) && photos.length > 0) {
    for (let i = 0; i < photos.length; i++) {
      const p: IncomingPhoto = photos[i] || {}
      const dataUrl = String(p.dataUrl || "")
      if (!dataUrl) continue

      let mime = String(p.type || "image/jpeg")
      let base64Data = dataUrl

      // If it's a data URL, split header/body
      if (dataUrl.startsWith("data:")) {
        const parts = dataUrl.split(",")
        if (parts.length >= 2) {
          const header = parts[0]
          base64Data = parts.slice(1).join(",")
          const m = header.match(/data:([^;]+);base64/i)
          if (m && m[1]) mime = m[1]
        }
      }

      const buf = Buffer.from(base64Data, "base64")
      if (!buf || buf.length === 0) continue

      const safeName = (p.name || `photo_${i + 1}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_")
      photoBuffers.push({
        filename: safeName,
        content: buf,
        contentType: mime,
      })
    }
  }
} catch (photoErr: any) {
  console.error("Photo processing error:", photoErr?.message || photoErr)
}
    }

    // File name for both email attachment and Vercel Blob
    const fileName = `adr-checklists/${driverName.replace(/\s+/g, "_")}_${inspectionDate.replace(/-/g, ".")}_${Date.now()}.pdf`
    console.log("Generated filename:", fileName)

    // Upload to Vercel Blob Storage
    console.log("Attempting Vercel Blob upload...")
    const blobResult = await uploadToVercelBlob(pdfBuffer, fileName)

    if (blobResult.success) {
      console.log("✓ Vercel Blob upload successful")
      console.log("Blob URL:", blobResult.url)
    } else {
      console.error("❌ Vercel Blob upload failed:", blobResult.error)
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
Remarks: ${remarks || ""}

${blobResult.success && blobResult.url ? `The document is also available online: ${blobResult.url}` : ""}

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
          </table>
          
          ${blobResult.success && blobResult.url ? `<p><strong>Online Access:</strong> <a href="${blobResult.url}" target="_blank" style="color: #0066cc;">View/Download PDF Online</a></p>` : ""}
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This email was generated automatically by the ADR Checklist System.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `ADR-Check_${driverName.replace(/\s+/g, "_")}_${inspectionDate.replace(/-/g, ".")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
        ...photoBuffers,
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
      if (blobResult.success) {
        message += " and saved to Vercel Blob Storage"
      } else if (blobResult.error) {
        message += ` (Blob storage upload failed: ${blobResult.error})`
      }

      return NextResponse.json({
        success: true,
        message: message,
        blobUrl: blobResult.url,
        blobUploadSuccess: blobResult.success,
        emailMessageId: emailResult.messageId,
        blobError: blobResult.success ? undefined : blobResult.error,
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
