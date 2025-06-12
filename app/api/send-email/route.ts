import { type NextRequest, NextResponse } from "next/server"
import * as nodemailer from "nodemailer"
import { google } from "googleapis"
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

// Google Drive API setup
const setupGoogleDrive = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  const drive = google.drive({ version: "v3", auth })
  return drive
}

// Upload file to Google Drive
const uploadToDrive = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
): Promise<string | null> => {
  try {
    const drive = await setupGoogleDrive()

    const fileMetadata = {
      name: fileName,
      parents: [folderId], // Specify the folder ID where the file should be uploaded
    }

    const media = {
      mimeType,
      body: Readable.from(fileBuffer),
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id,webViewLink",
    })

    return response.data.webViewLink || null
  } catch (error) {
    console.error("Error uploading to Google Drive:", error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inspectorName, driverName, truckPlate, trailerPlate, inspectionDate, pdfBase64 } = body

    if (!inspectorName || !pdfBase64) {
      return NextResponse.json({ message: "Missing inspector name or PDF data" }, { status: 400 })
    }

    const recipients = inspectorEmails[inspectorName]
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ message: "No email recipients found for this inspector" }, { status: 400 })
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, "base64")

    // File name for both email attachment and Google Drive
    const fileName = `ADR_Check_${driverName.replace(/\s+/g, "_")}_${inspectionDate.replace(/-/g, "_")}.pdf`

    // Upload to Google Drive if folder ID is configured
    let driveLink = null
    const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (googleDriveFolderId) {
      driveLink = await uploadToDrive(pdfBuffer, fileName, "application/pdf", googleDriveFolderId)
    }

    // Email options
    const mailOptions = {
      from: '"ADR Checklist System" <alblas456@gmail.com>',
      to: recipients.join(", "),
      subject: `ADR Checklist - ${driverName} (${truckPlate}/${trailerPlate})`,
      text: `Please find attached the ADR Checklist for:

Driver: ${driverName}
Truck: ${truckPlate}
Trailer: ${trailerPlate}
Inspection Date: ${inspectionDate}
Inspector: ${inspectorName}

${driveLink ? `The document is also available on Google Drive: ${driveLink}` : ""}

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
          
          ${driveLink ? `<p><strong>Google Drive:</strong> <a href="${driveLink}" target="_blank">View document in Google Drive</a></p>` : ""}
          
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
    await transporter.sendMail(mailOptions)

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)${driveLink ? " and saved to Google Drive" : ""}`,
      driveLink: driveLink,
    })
  } catch (error) {
    console.error("Email sending error:", error)
    return NextResponse.json({ message: "Failed to send email. Please try again." }, { status: 500 })
  }
}
