import { type NextRequest, NextResponse } from "next/server"
import { Readable } from "stream"

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

// Google Drive API setup
const setupGoogleDrive = async () => {
  try {
    console.log("=== Setting up Google Drive for Test ===")

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

    const formattedPrivateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY)
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
    const aboutResponse = await drive.about.get({ fields: "user" })
    console.log("✓ Authenticated as:", aboutResponse.data.user?.emailAddress)

    return drive
  } catch (error: any) {
    console.error("❌ Google Drive setup failed:", error.message)
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log("=== Testing Google Drive Upload ===")

    const drive = await setupGoogleDrive()
    if (!drive) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to setup Google Drive connection",
        },
        { status: 500 },
      )
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!
    console.log("Testing with folder/drive ID:", folderId)

    // Check if it's a shared drive
    let isSharedDrive = false
    let targetInfo = null

    try {
      const driveInfo = await drive.drives.get({ driveId: folderId })
      console.log("✓ Target is a Shared Drive:", driveInfo.data.name)
      isSharedDrive = true
      targetInfo = {
        type: "Shared Drive",
        name: driveInfo.data.name,
        id: driveInfo.data.id,
      }
    } catch (driveError) {
      console.log("Not a shared drive, checking as regular folder...")
      try {
        const folderInfo = await drive.files.get({
          fileId: folderId,
          fields: "id,name,parents,capabilities",
          supportsAllDrives: true,
        })
        console.log("✓ Target is a regular folder:", folderInfo.data.name)
        targetInfo = {
          type: "Regular Folder",
          name: folderInfo.data.name,
          id: folderInfo.data.id,
          parents: folderInfo.data.parents,
          capabilities: folderInfo.data.capabilities,
        }
      } catch (folderError) {
        console.error("❌ Cannot access target:", folderError.message)
        return NextResponse.json(
          {
            success: false,
            error: `Cannot access target: ${folderError.message}`,
            details: {
              code: folderError.code,
              status: folderError.status,
            },
          },
          { status: 500 },
        )
      }
    }

    // Create a test file
    const testFileName = `test-upload-${Date.now()}.txt`
    const testContent = "This is a test file for ADR Checklist Google Drive integration"
    const testBuffer = Buffer.from(testContent, "utf8")

    console.log("Creating test file:", testFileName)

    const fileMetadata = {
      name: testFileName,
      parents: [folderId],
    }

    const uploadOptions: any = {
      requestBody: fileMetadata,
      media: {
        mimeType: "text/plain",
        body: Readable.from(testBuffer),
      },
      fields: "id,name,webViewLink,parents",
    }

    if (isSharedDrive) {
      uploadOptions.supportsAllDrives = true
      console.log("✓ Using shared drive upload parameters")
    }

    const response = await drive.files.create(uploadOptions)

    console.log("✓ Test file created successfully!")
    console.log("File ID:", response.data.id)
    console.log("Web view link:", response.data.webViewLink)

    // Clean up - delete the test file
    try {
      await drive.files.delete({
        fileId: response.data.id!,
        supportsAllDrives: isSharedDrive,
      })
      console.log("✓ Test file deleted")
    } catch (deleteError) {
      console.warn("Could not delete test file:", deleteError.message)
    }

    return NextResponse.json({
      success: true,
      message: "Google Drive upload test successful!",
      details: {
        targetInfo,
        testFile: {
          id: response.data.id,
          name: response.data.name,
          link: response.data.webViewLink,
        },
      },
    })
  } catch (error: any) {
    console.error("Test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: {
          code: error.code,
          status: error.status,
          errors: error.errors,
        },
      },
      { status: 500 },
    )
  }
}
