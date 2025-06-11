import { type NextRequest, NextResponse } from "next/server"
import * as nodemailer from "nodemailer"

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
        user: "alblas456@gmail.com",
        pass: "nllgdjeylcwaaetw",
      },
    })

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, "base64")

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
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This email was generated automatically by the ADR Checklist System.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `ADR_Check_${driverName}_${inspectionDate.replace(/-/g, "_")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    }

    // Send email
    await transporter.sendMail(mailOptions)

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)`,
    })
  } catch (error) {
    console.error("Email sending error:", error)
    return NextResponse.json({ message: "Failed to send email. Please try again." }, { status: 500 })
  }
}
