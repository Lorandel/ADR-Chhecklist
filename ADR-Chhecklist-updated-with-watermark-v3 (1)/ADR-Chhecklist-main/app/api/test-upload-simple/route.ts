import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Simple Upload Test ===")

    // Check if we have all required environment variables
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required environment variables",
          missing: {
            clientEmail: !process.env.GOOGLE_CLIENT_EMAIL,
            privateKey: !process.env.GOOGLE_PRIVATE_KEY,
            folderId: !process.env.GOOGLE_DRIVE_FOLDER_ID,
          },
        },
        { status: 400 },
      )
    }

    // Format private key
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    privateKey = privateKey.replace(/^["']|["']$/g, "")
    privateKey = privateKey.replace(/\\\\n/g, "\n")
    privateKey = privateKey.replace(/\\n/g, "\n")

    const { google } = await import("googleapis")

    // Create auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.file"],
    })

    const drive = google.drive({ version: "v3", auth })

    // Create a very simple test file
    const testContent = `Test file created at ${new Date().toISOString()}`
    const fileName = `simple_test_${Date.now()}.txt`

    console.log("Attempting to create file:", fileName)
    console.log("Target folder:", process.env.GOOGLE_DRIVE_FOLDER_ID)
    console.log("File content length:", testContent.length)

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "text/plain",
        body: testContent,
      },
      fields: "id,name,webViewLink,size,parents",
    })

    console.log("✓ File created successfully!")
    console.log("File details:", response.data)

    // Clean up - delete the test file
    if (response.data.id) {
      await drive.files.delete({ fileId: response.data.id })
      console.log("✓ Test file cleaned up")
    }

    return NextResponse.json({
      success: true,
      message: "File upload test successful!",
      fileDetails: {
        id: response.data.id,
        name: response.data.name,
        size: response.data.size,
        parents: response.data.parents,
        webViewLink: response.data.webViewLink,
      },
    })
  } catch (error: any) {
    console.error("❌ Simple upload test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: {
          code: error.code,
          status: error.status,
          errors: error.errors,
          response: error.response?.data,
        },
      },
      { status: 500 },
    )
  }
}
