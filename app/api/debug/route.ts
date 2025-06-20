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
      GOOGLE_PRIVATE_KEY_STARTS_WITH: process.env.GOOGLE_PRIVATE_KEY?.substring(0, 50) || "NOT_SET",
    }

    console.log("Environment values:", envValues)

    // Test Google Drive setup if all vars are present
    let googleDriveTest = null
    if (envCheck.GOOGLE_CLIENT_EMAIL && envCheck.GOOGLE_PRIVATE_KEY && envCheck.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        console.log("Testing Google Drive...")

        // Clean and format the private key properly
        let privateKey = process.env.GOOGLE_PRIVATE_KEY

        // Remove any quotes and extra escaping
        privateKey = privateKey?.replace(/^["']|["']$/g, "") // Remove surrounding quotes
        privateKey = privateKey?.replace(/\\\\n/g, "\n") // Replace \\n with \n
        privateKey = privateKey?.replace(/\\n/g, "\n") // Replace \n with actual newlines

        // Ensure it starts and ends correctly
        if (privateKey && !privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
          throw new Error("Private key does not contain proper BEGIN marker")
        }

        console.log("Private key length after cleaning:", privateKey?.length)
        console.log("Private key starts with:", privateKey?.substring(0, 50))
        console.log("Private key ends with:", privateKey?.substring(privateKey.length - 50))

        const { google } = await import("googleapis")

        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: privateKey,
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
          privateKeyInfo: {
            length: process.env.GOOGLE_PRIVATE_KEY?.length,
            startsWithBegin: process.env.GOOGLE_PRIVATE_KEY?.includes("-----BEGIN PRIVATE KEY-----"),
            endsWithEnd: process.env.GOOGLE_PRIVATE_KEY?.includes("-----END PRIVATE KEY-----"),
            hasNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes("\n"),
            hasEscapedNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes("\\n"),
          },
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
