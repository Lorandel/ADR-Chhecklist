import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Testing Email Configuration ===")

    // Check environment variables
    const emailConfig = {
      GMAIL_USER: process.env.GMAIL_USER,
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    }

    console.log("Email config:", {
      hasUser: !!emailConfig.GMAIL_USER,
      hasPassword: !!emailConfig.GMAIL_APP_PASSWORD,
      userEmail: emailConfig.GMAIL_USER,
    })

    if (!emailConfig.GMAIL_USER || !emailConfig.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing email configuration",
          details: {
            hasUser: !!emailConfig.GMAIL_USER,
            hasPassword: !!emailConfig.GMAIL_APP_PASSWORD,
          },
        },
        { status: 500 },
      )
    }

    // Test nodemailer setup
    try {
      const nodemailer = await import("nodemailer")

      // Create test account if needed
      let testAccount
      let transporter

      if (process.env.NODE_ENV === "development") {
        console.log("Creating test account for development...")
        testAccount = await nodemailer.createTestAccount()

        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        })
      } else {
        // Use real Gmail account
        transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailConfig.GMAIL_USER,
            pass: emailConfig.GMAIL_APP_PASSWORD,
          },
          debug: true,
        })
      }

      // Verify connection
      console.log("Verifying email connection...")
      await transporter.verify()
      console.log("Email connection verified successfully")

      // Send test email
      console.log("Sending test email...")
      const info = await transporter.sendMail({
        from: `"ADR Checklist Test" <${emailConfig.GMAIL_USER}>`,
        to: emailConfig.GMAIL_USER, // Send to self for testing
        subject: "ADR Checklist Email Test",
        text: "This is a test email from the ADR Checklist system.",
        html: "<b>This is a test email from the ADR Checklist system.</b>",
      })

      console.log("Test email sent:", info.messageId)

      if (process.env.NODE_ENV === "development") {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info))
      }

      return NextResponse.json({
        success: true,
        message: "Email configuration is working correctly",
        details: {
          messageId: info.messageId,
          previewUrl: process.env.NODE_ENV === "development" ? nodemailer.getTestMessageUrl(info) : null,
        },
      })
    } catch (emailError) {
      console.error("Email test failed:", emailError)
      return NextResponse.json(
        {
          success: false,
          error: "Email test failed",
          details: {
            message: emailError.message,
            code: emailError.code,
            command: emailError.command,
            response: emailError.response,
          },
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Test endpoint error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Test endpoint failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
