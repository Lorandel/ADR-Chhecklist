import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Testing Shared Drive Setup ===")

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    console.log("Current GOOGLE_DRIVE_FOLDER_ID:", folderId)

    if (!folderId) {
      return NextResponse.json({
        success: false,
        error: "GOOGLE_DRIVE_FOLDER_ID not set",
      })
    }

    // Format the private key
    let privateKey = process.env.GOOGLE_PRIVATE_KEY
    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: "GOOGLE_PRIVATE_KEY not set",
      })
    }

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

    // Test 1: Check if it's a shared drive
    let driveInfo = null
    let isSharedDrive = false

    try {
      driveInfo = await drive.drives.get({ driveId: folderId })
      isSharedDrive = true
      console.log("✓ This IS a Shared Drive:", driveInfo.data.name)
    } catch (error) {
      console.log("❌ This is NOT a Shared Drive")
      console.log("Error:", error.message)

      // Try as regular folder
      try {
        const folderInfo = await drive.files.get({
          fileId: folderId,
          fields: "id,name,parents",
        })
        console.log("This is a regular folder:", folderInfo.data.name)
        return NextResponse.json({
          success: false,
          error: "You're using a regular folder ID, not a Shared Drive ID",
          details: {
            type: "Regular Folder",
            name: folderInfo.data.name,
            id: folderInfo.data.id,
            message: "Please use the Shared Drive ID instead",
          },
        })
      } catch (folderError) {
        return NextResponse.json({
          success: false,
          error: "Cannot access the specified ID as either Shared Drive or folder",
          details: folderError.message,
        })
      }
    }

    // Test 2: Check permissions
    try {
      const permissions = await drive.permissions.list({
        fileId: folderId,
        supportsAllDrives: true,
      })

      const serviceAccountPermission = permissions.data.permissions?.find(
        (p) => p.emailAddress === process.env.GOOGLE_CLIENT_EMAIL,
      )

      console.log("Service account permission:", serviceAccountPermission)

      return NextResponse.json({
        success: true,
        message: "Shared Drive setup is correct!",
        details: {
          driveInfo: {
            name: driveInfo.data.name,
            id: driveInfo.data.id,
          },
          serviceAccountAccess: !!serviceAccountPermission,
          serviceAccountRole: serviceAccountPermission?.role || "Not found",
        },
      })
    } catch (permError) {
      return NextResponse.json({
        success: false,
        error: "Cannot check permissions",
        details: permError.message,
      })
    }
  } catch (error: any) {
    console.error("Test failed:", error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        status: error.status,
      },
    })
  }
}
