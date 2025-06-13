import { type NextRequest, NextResponse } from "next/server"
import { Readable } from "stream"

const inspectorEmails: Record<string, string[]> = {
  "Eduard Tudose": ["eduard.tudose@alblas.nl"],
  "Angela Ilis": ["angela.ilis@alblas.nl"],
  "Lucian Sistac": ["lucian.sistac@alblas.nl"],
  "Robert Kerekes": ["robert.kerekes@alblas.nl"],
  "Alexandru Dogariu": ["alexandru.dogariu@alblas.nl"],
  "Martian Gherasim": ["martian.gherasim@alblas.nl"],
  "Alexandru Florea": [
    "eduard.tudose@alblas.nl",
    "angela.ilis@alblas.nl",
    "lucian.sistac@alblas.nl",
    "robert.kerekes@alblas.nl",
    "alexandru.dogariu@alblas.nl",
    "martian.gherasim@alblas.nl",
  ],
}

// Function to properly format the private key
const formatPrivateKey = (privateKey: string): string => {
  // Remove any surrounding quotes
  let key = privateKey.replace(/^["']|["']$/g, "")

  // Replace escaped newlines with actual newlines
  key = key.replace(/\\\\n/g, "\n")
  key = key.replace(/\\n/g, "\n")

  // Ensure proper formatting
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Invalid private key format: missing BEGIN marker")
  }

  if (!key.includes("-----END PRIVATE KEY-----")) {
    throw new Error("Invalid private key format: missing END marker")
  }

  return key
}

// Google Drive API setup with comprehensive error handling
const setupGoogleDrive = async () => {
  try {
    console.log("=== Setting up Google Drive ===")

    // Validate all required environment variables
    const requiredVars = {
      GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
      GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
    }

    for (const [key, value] of Object.entries(requiredVars)) {
      if (!value) {
        console.error(`Missing environment variable: ${key}`)
        return null
      }
    }

    console.log("✓ All environment variables present")
    console.log("Client email:", process.env.GOOGLE_CLIENT_EMAIL)
    console.log("Folder ID:", process.env.GOOGLE_DRIVE_FOLDER_ID)
    console.log("Private key length:", process.env.GOOGLE_PRIVATE_KEY.length)

    // Format the private key properly
    const formattedPrivateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY)
    console.log("✓ Private key formatted successfully")

    const { google } = await import("googleapis")

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: formattedPrivateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.file"],
    })

    const drive = google.drive({ version: "v3", auth })

    // Test authentication
    console.log("Testing authentication...")
    const aboutResponse = await drive.about.get({ fields: "user" })
    console.log("✓ Authenticated as:", aboutResponse.data.user?.emailAddress)

    // Test folder access
    console.log("Testing folder access...")
    const folderResponse = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: "id,name,parents",
    })
    console.log("✓ Folder accessible:", folderResponse.data.name)

    return drive
  } catch (error: any) {
    console.error("❌ Google Drive setup failed:", error.message)
    if (error.code) {
      console.error("Error code:", error.code)
    }
    if (error.status) {
      console.error("HTTP status:", error.status)
    }
    return null
  }
}

// Upload file to Google Drive with detailed logging
const uploadToDrive = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
): Promise<{ success: boolean; link?: string; error?: string }> => {
  try {
    console.log("=== Starting Google Drive Upload ===")
    console.log("File name:", fileName)
    console.log("File size:", fileBuffer.length, "bytes")
    console.log("MIME type:", mimeType)
    console.log("Target folder:", folderId)

    const drive = await setupGoogleDrive()
    if (!drive) {
      return { success: false, error: "Failed to setup Google Drive connection" }
    }

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    }

    const media = {
      mimeType,
      body: Readable.from(fileBuffer),
    }

    console.log("Uploading file...")
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id,name,webViewLink,parents",
    })

    console.log("✓ Upload successful!")
    console.log("File ID:", response.data.id)
    console.log("File name:", response.data.name)
    console.log("Parents:", response.data.parents)
    console.log("Web view link:", response.data.webViewLink)

    return {
      success: true,
      link: response.data.webViewLink || undefined,
    }
  } catch (error: any) {
    console.error("❌ Google Drive upload failed:", error.message)
    console.error("Error details:", {
      code: error.code,
      status: error.status,
      message: error.message,
    })
    return {
      success: false,
      error: `Upload failed: ${error.message}`,
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== Email API Called ===")

    // Check email environment variables first
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("Missing email credentials:", {
        hasGmailUser: !!process.env.GMAIL_USER,
        hasGmailAppPassword: !!process.env.GMAIL_APP_PASSWORD,
      })
      return NextResponse.json(
        {
          success: false,
          message: "Email configuration missing. Please check GMAIL_USER and GMAIL_APP_PASSWORD environment variables.",
        },
        { status: 500 },
      )
    }

    const body = await req.json()
    const { inspectorName, driverName, truckPlate, trailerPlate, inspectionDate, pdfBase64 } = body

    console.log("Inspector:", inspectorName)
    console.log("Driver:", driverName)
    console.log("PDF size:", pdfBase64?.length || 0, "characters")

    // Validate required email environment variables
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
    try {
      const pdfBuffer = Buffer.from(pdfBase64, "base64")
      console.log("PDF buffer size:", pdfBuffer.length, "bytes")

      if (pdfBuffer.length === 0) {
        throw new Error("PDF buffer is empty")
      }

      // File name for both email attachment and Google Drive
      const fileName = `ADR-Check_${driverName.replace(/\s+/g, "_")}_${inspectionDate.replace(/-/g, ".")}.pdf`
      console.log("Generated filename:", fileName)

      // Upload to Google Drive
      let driveResult = { success: false, link: undefined, error: "Not attempted" }
      const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

      if (googleDriveFolderId) {
        console.log("Attempting Google Drive upload...")
        driveResult = await uploadToDrive(pdfBuffer, fileName, "application/pdf", googleDriveFolderId)
      } else {
        console.log("Google Drive folder ID not configured, skipping upload")
      }

      // Dynamic import for nodemailer
      const nodemailer = await import("nodemailer")

      // Create transporter with detailed logging
      console.log("Creating email transporter with:", process.env.GMAIL_USER)
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
        logger: true, // Enable built-in logger
        debug: true, // Enable debug output
      })

      // Verify transporter configuration
      console.log("Verifying email configuration...")
      try {
        await transporter.verify()
        console.log("✓ Email transporter verified successfully")
      } catch (verifyError: any) {
        console.error("Email verification failed:", verifyError)
        console.error("Error details:", {
          code: verifyError.code,
          command: verifyError.command,
          response: verifyError.response,
          responseCode: verifyError.responseCode,
        })

        return NextResponse.json(
          {
            success: false,
            message: `Email configuration is invalid: ${verifyError.message}`,
            details: {
              code: verifyError.code,
              command: verifyError.command,
              response: verifyError.response,
            },
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

${driveResult.success && driveResult.link ? `The document is also available on Google Drive: ${driveResult.link}` : ""}

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
            
            ${driveResult.success && driveResult.link ? `<p><strong>Google Drive:</strong> <a href="${driveResult.link}" target="_blank">View document in Google Drive</a></p>` : ""}
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This email was generated automatically by the ADR Checklist System.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: "application/pdf",
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
        if (driveResult.success) {
          message += " and saved to Google Drive"
        } else if (driveResult.error && driveResult.error !== "Not attempted") {
          message += ` (Google Drive upload failed: ${driveResult.error})`
        }

        return NextResponse.json({
          success: true,
          message: message,
          driveLink: driveResult.link,
          driveUploadSuccess: driveResult.success,
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
  } catch (err: any) {
    console.error("❌ Email API error:", err)

    // Provide more specific error messages based on error type
    let errorMessage = "Failed to send email. Please try again."
    const statusCode = 500

    if (err.code === "EAUTH") {
      errorMessage = "Authentication failed. Please check your email credentials."
    } else if (err.code === "ESOCKET") {
      errorMessage = "Network error when connecting to email server."
    } else if (err.message.includes("configuration")) {
      errorMessage = "Email configuration error: " + err.message
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        error: err.message,
        details: {
          code: err.code,
          command: err.command,
          response: err.response,
        },
      },
      { status: statusCode },
    )
  }
}
