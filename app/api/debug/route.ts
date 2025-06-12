import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Debug Endpoint Called ===")

    // Check all environment variables
    const envCheck = {
      GMAIL_USER: !!process.env.GMAIL_USER,
      GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
      GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
      GOOGLE_DRIVE_FOLDER_ID: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    }

    console.log("Environment variables check:", envCheck)

    // Show actual values (safely)
    const envValues = {
      GMAIL_USER: process.env.GMAIL_USER || "NOT_SET",
      GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL || "NOT_SET",
      GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || "NOT_SET",
      GOOGLE_PRIVATE_KEY_LENGTH: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
    }

    console.log("Environment values:", envValues)

    // Test Google Drive setup if all vars are present
    let googleDriveTest = null
    if (envCheck.GOOGLE_CLIENT_EMAIL && envCheck.GOOGLE_PRIVATE_KEY && envCheck.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        console.log("Testing Google Drive...")
        const { google } = await import("googleapis")

        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          },
          scopes: ["https://www.googleapis.com/auth/drive"],
        })

        const drive = google.drive({ version: "v3", auth })

        // Test authentication
        const aboutResponse = await drive.about.get({ fields: "user" })
        console.log("Google Drive auth successful:", aboutResponse.data.user?.emailAddress)

        // Test folder access
        const folderResponse = await drive.files.get({
          fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          fields: "id,name,permissions",
        })
        console.log("Folder access successful:", folderResponse.data.name)

        googleDriveTest = {
          success: true,
          authenticatedAs: aboutResponse.data.user?.emailAddress,
          folderName: folderResponse.data.name,
          folderId: folderResponse.data.id,
        }
      } catch (error: any) {
        console.error("Google Drive test failed:", error.message)
        googleDriveTest = {
          success: false,
          error: error.message,
          code: error.code,
          status: error.status,
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environmentVariables: envCheck,
      environmentValues: envValues,
      googleDriveTest: googleDriveTest,
    })
  } catch (error: any) {
    console.error("Debug endpoint error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
