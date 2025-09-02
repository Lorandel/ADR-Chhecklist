import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Simple Google Drive Test ===")
    console.log("Timestamp:", new Date().toISOString())

    // Check environment variables
    const envCheck = {
      GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
      GOOGLE_PRIVATE_KEY_LENGTH: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
    }

    console.log("Environment check:", envCheck)

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return NextResponse.json({
        success: false,
        error: "Missing environment variables",
        envCheck,
      })
    }

    // Format private key
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    privateKey = privateKey.replace(/^["']|["']$/g, "")
    privateKey = privateKey.replace(/\\\\n/g, "\n")
    privateKey = privateKey.replace(/\\n/g, "\n")

    const { google } = await import("googleapis")

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    })

    const drive = google.drive({ version: "v3", auth })

    // Quick authentication test
    const aboutResponse = await drive.about.get({ fields: "user" })
    console.log("Authenticated as:", aboutResponse.data.user?.emailAddress)

    // Quick folder access test
    const folderResponse = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: "id,name,capabilities,trashed",
      supportsAllDrives: true,
    })

    console.log("Folder info:", {
      name: folderResponse.data.name,
      id: folderResponse.data.id,
      trashed: folderResponse.data.trashed,
      canAddChildren: folderResponse.data.capabilities?.canAddChildren,
    })

    return NextResponse.json({
      success: true,
      message: "Basic Google Drive test successful",
      details: {
        authenticatedAs: aboutResponse.data.user?.emailAddress,
        folderName: folderResponse.data.name,
        folderId: folderResponse.data.id,
        folderTrashed: folderResponse.data.trashed,
        canAddChildren: folderResponse.data.capabilities?.canAddChildren,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("Simple test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        status: error.status,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
