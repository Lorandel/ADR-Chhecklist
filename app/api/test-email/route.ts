import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  // Safe by default (no side effects). To actually send a test email, call /api/test-email?send=1
  const url = new URL(req.url)
  const shouldSend = url.searchParams.get("send") === "1"

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

    const info = await transporter.sendMail({
      from: `"ADR Checklist Test" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: "ADR Checklist Email Test",
      text: "This is a test email from the ADR Checklist system.",
      html: "<b>This is a test email from the ADR Checklist system.</b>",
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
