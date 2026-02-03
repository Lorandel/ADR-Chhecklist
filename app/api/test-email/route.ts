import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  // Safe by default (no side effects). To actually send a test email, call /api/test-email?send=1
  const url = new URL(req.url)
  const shouldSend = url.searchParams.get("send") === "1"
  const withAttachment = url.searchParams.get("attach") === "1"

  const hasUser = !!process.env.GMAIL_USER
  const hasPassword = !!process.env.GMAIL_APP_PASSWORD

  if (!shouldSend) {
    return NextResponse.json({
      success: true,
      configured: hasUser && hasPassword,
      message: hasUser && hasPassword ? "Email config is set." : "Missing GMAIL_USER or GMAIL_APP_PASSWORD.",
      details: { hasUser, hasPassword },
      didSend: false,
    })
  }

  if (!hasUser || !hasPassword) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: "Missing email configuration (GMAIL_USER / GMAIL_APP_PASSWORD).",
      details: { hasUser, hasPassword },
      didSend: false,
    })
  }

  try {
    const nodemailer = await import("nodemailer")

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    await transporter.verify()

// Optionally attach a small ZIP so the test matches real usage
let attachments: any[] | undefined = undefined
if (withAttachment) {
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  zip.file("README.txt", "ADR Checklist test attachment.")
  // tiny minimal PDF header (valid enough for attachment)
  const minimalPdf = Buffer.from("%PDF-1.3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
  zip.file("test.pdf", minimalPdf)
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } })
  attachments = [
    {
      filename: "adr-checklist-test.zip",
      content: zipBuffer,
      contentType: "application/zip",
    },
  ]
}

const info = await transporter.sendMail({
  from: `"ADR Checklist Test" <${process.env.GMAIL_USER}>`,
  to: process.env.GMAIL_USER,
  subject: withAttachment ? "ADR Checklist Email Test (with ZIP)" : "ADR Checklist Email Test",
  text: withAttachment
    ? "This is a test email from the ADR Checklist system (with ZIP attachment)."
    : "This is a test email from the ADR Checklist system.",
  html: withAttachment
    ? "<b>This is a test email from the ADR Checklist system (with ZIP attachment).</b>"
    : "<b>This is a test email from the ADR Checklist system.</b>",
  attachments,
})


    return NextResponse.json({
      success: true,
      configured: true,
      message: "Test email sent.",
      didSend: true,
      details: { messageId: info.messageId },
    })
  } catch (error: any) {
    // Return 200 to avoid build/export failures; surface the error in the JSON payload.
    return NextResponse.json({
      success: false,
      configured: true,
      didSend: true,
      error: error?.message || "Email test failed",
    })
  }
}
