import { type NextRequest, NextResponse } from "next/server"

// Test Google Drive connection
const testGoogleDrive = async () => {
  try {
    console.log("=== Testing Google Drive Connection ===")

    // Check environment variables
    console.log("GOOGLE_CLIENT_EMAIL:", process.env.GOOGLE_CLIENT_EMAIL)
    console.log("GOOGLE_PRIVATE_KEY exists:", !!process.env.GOOGLE_PRIVATE_KEY)
    console.log("GOOGLE_DRIVE_FOLDER_ID:", process.env.GOOGLE_DRIVE_FOLDER_ID)

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return {
        success: false,
        error: "Missing required environment variables",
        details: {
          hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
          hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
        },
      }
    }

    const { google } = await import("googleapis")

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.file"],
    })

    const drive = google.drive({ version: "v3", auth })

    // Test 1: Check authentication
    console.log("Testing authentication...")
    const aboutResponse = await drive.about.get({ fields: "user" })
    console.log("Authenticated as:", aboutResponse.data.user?.emailAddress)

    // Test 2: Check folder access
    console.log("Testing folder access...")
    const folderResponse = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: "id,name,parents,permissions",
    })
    console.log("Folder found:", folderResponse.data.name)

    // Test 3: List files in folder
    console.log("Listing files in folder...")
    const filesResponse = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
      fields: "files(id,name,createdTime)",
    })
    console.log("Files in folder:", filesResponse.data.files?.length || 0)

    // Test 4: Try to create a test file
    console.log("Testing file creation...")
    const testFileName = `test_${Date.now()}.txt`
    const testContent = "This is a test file created by the ADR Checklist system"

    const createResponse = await drive.files.create({
      requestBody: {
        name: testFileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "text/plain",
        body: testContent,
      },
      fields: "id,name,webViewLink",
    })

    console.log("Test file created:", createResponse.data.name)
    console.log("Test file ID:", createResponse.data.id)

    // Test 5: Delete the test file
    if (createResponse.data.id) {
      await drive.files.delete({ fileId: createResponse.data.id })
      console.log("Test file deleted successfully")
    }

    return {
      success: true,
      message: "Google Drive connection successful!",
      details: {
        authenticatedAs: aboutResponse.data.user?.emailAddress,
        folderName: folderResponse.data.name,
        folderID: folderResponse.data.id,
        filesInFolder: filesResponse.data.files?.length || 0,
        testFileCreated: createResponse.data.name,
        testFileLink: createResponse.data.webViewLink,
      },
    }
  } catch (error: any) {
    console.error("Google Drive test failed:", error)
    return {
      success: false,
      error: error.message,
      details: error.code ? { code: error.code, status: error.status } : null,
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await testGoogleDrive()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        details: result.details,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
        },
        { status: 500 },
      )
    }
  } catch (error: any) {
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
