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
      passwordLength: emailConfig.GMAIL_APP_PASSWORD?.length || 0,
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

      console.log("Creating test transporter...")
      // Use real Gmail account
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailConfig.GMAIL_USER,
          pass: emailConfig.GMAIL_APP_PASSWORD,
        },
        logger: true,
        debug: true,
      })

      // Verify connection
      console.log("Verifying email connection...")
      try {
        await transporter.verify()
        console.log("Email connection verified successfully")
      } catch (verifyError: any) {
        console.error("Email verification failed:", verifyError)
        console.error("Error details:", {
          code: verifyError.code,
          command: verifyError.command,
          response: verifyError.response,
        })

        return NextResponse.json(
          {
            success: false,
            error: `Email verification failed: ${verifyError.message}`,
            details: {
              code: verifyError.code,
              command: verifyError.command,
              response: verifyError.response,
              suggestion:
                "Check if your Gmail account has 'Less secure app access' enabled or if you need to use an App Password.",
            },
          },
          { status: 500 },
        )
      }

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
