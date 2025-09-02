import { type NextRequest, NextResponse } from "next/server"
import { Readable } from "stream"

// Function to properly format the private key
const formatPrivateKey = (privateKey: string): string => {
  let key = privateKey.replace(/^["']|["']$/g, "")
  key = key.replace(/\\\\n/g, "\n")
  key = key.replace(/\\n/g, "\n")

  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Invalid private key format: missing BEGIN marker")
  }
  if (!key.includes("-----END PRIVATE KEY-----")) {
    throw new Error("Invalid private key format: missing END marker")
  }
  return key
}

export async function GET(req: NextRequest) {
  const testResults = {
    timestamp: new Date().toISOString(),
    environmentVariables: {},
    authentication: {},
    folderAccess: {},
    permissions: {},
    uploadTest: {},
    quotaInfo: {},
  }

  try {
    console.log("=== Comprehensive Google Drive Test ===")

    // Step 1: Check Environment Variables
    console.log("1. Checking environment variables...")
    testResults.environmentVariables = {
      hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
      hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
    }

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      throw new Error("Missing required environment variables")
    }

    // Step 2: Setup Google Drive API
    console.log("2. Setting up Google Drive API...")
    const formattedPrivateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY)
    const { google } = await import("googleapis")

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: formattedPrivateKey,
      },
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      ],
    })

    const drive = google.drive({ version: "v3", auth })

    // Step 3: Test Authentication
    console.log("3. Testing authentication...")
    try {
      const aboutResponse = await drive.about.get({
        fields: "user,storageQuota",
      })
      testResults.authentication = {
        success: true,
        authenticatedAs: aboutResponse.data.user?.emailAddress,
        storageQuota: aboutResponse.data.storageQuota,
      }
      console.log("✓ Authentication successful")
    } catch (authError) {
      testResults.authentication = {
        success: false,
        error: authError.message,
        code: authError.code,
        status: authError.status,
      }
      throw authError
    }

    // Step 4: Test Folder Access
    console.log("4. Testing folder access...")
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    try {
      const folderResponse = await drive.files.get({
        fileId: folderId,
        fields: "id,name,parents,capabilities,owners,permissionIds,shared,trashed",
        supportsAllDrives: true,
      })

      testResults.folderAccess = {
        success: true,
        folderName: folderResponse.data.name,
        folderId: folderResponse.data.id,
        parents: folderResponse.data.parents,
        capabilities: folderResponse.data.capabilities,
        owners: folderResponse.data.owners,
        shared: folderResponse.data.shared,
        trashed: folderResponse.data.trashed,
      }
      console.log("✓ Folder access successful")
    } catch (folderError) {
      testResults.folderAccess = {
        success: false,
        error: folderError.message,
        code: folderError.code,
        status: folderError.status,
      }
      throw folderError
    }

    // Step 5: Check Permissions
    console.log("5. Checking folder permissions...")
    try {
      const permissions = await drive.permissions.list({
        fileId: folderId,
        fields: "permissions(id,type,role,emailAddress,displayName)",
        supportsAllDrives: true,
      })

      const serviceAccountPermission = permissions.data.permissions?.find(
        (p) => p.emailAddress === process.env.GOOGLE_CLIENT_EMAIL,
      )

      testResults.permissions = {
        success: true,
        allPermissions: permissions.data.permissions,
        serviceAccountPermission: serviceAccountPermission,
        hasWriteAccess: serviceAccountPermission?.role === "writer" || serviceAccountPermission?.role === "owner",
      }
      console.log("✓ Permissions check completed")
    } catch (permError) {
      testResults.permissions = {
        success: false,
        error: permError.message,
        code: permError.code,
        status: permError.status,
      }
    }

    // Step 6: Check Storage Quota
    console.log("6. Checking storage quota...")
    try {
      const aboutResponse = await drive.about.get({
        fields: "storageQuota",
      })

      testResults.quotaInfo = {
        success: true,
        quota: aboutResponse.data.storageQuota,
      }
      console.log("✓ Storage quota check completed")
    } catch (quotaError) {
      testResults.quotaInfo = {
        success: false,
        error: quotaError.message,
      }
    }

    // Step 7: Test File Upload
    console.log("7. Testing file upload...")
    const testFileName = `test-upload-${Date.now()}.txt`
    const testContent = `Test file created at ${new Date().toISOString()}\nThis tests the ADR Checklist Google Drive integration.`
    const testBuffer = Buffer.from(testContent, "utf8")

    try {
      const fileMetadata = {
        name: testFileName,
        parents: [folderId],
      }

      const uploadResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: "text/plain",
          body: Readable.from(testBuffer),
        },
        fields: "id,name,webViewLink,parents,size",
        supportsAllDrives: true,
      })

      testResults.uploadTest = {
        success: true,
        fileId: uploadResponse.data.id,
        fileName: uploadResponse.data.name,
        webViewLink: uploadResponse.data.webViewLink,
        parents: uploadResponse.data.parents,
        size: uploadResponse.data.size,
      }

      console.log("✓ File upload successful")

      // Clean up - delete the test file
      try {
        await drive.files.delete({
          fileId: uploadResponse.data.id!,
          supportsAllDrives: true,
        })
        testResults.uploadTest.cleanupSuccess = true
        console.log("✓ Test file cleaned up")
      } catch (deleteError) {
        testResults.uploadTest.cleanupSuccess = false
        testResults.uploadTest.cleanupError = deleteError.message
        console.warn("⚠ Could not delete test file:", deleteError.message)
      }
    } catch (uploadError) {
      testResults.uploadTest = {
        success: false,
        error: uploadError.message,
        code: uploadError.code,
        status: uploadError.status,
        details: uploadError.errors,
      }
      console.error("❌ File upload failed:", uploadError.message)
    }

    // Step 8: List recent files in folder
    console.log("8. Listing recent files in folder...")
    try {
      const filesResponse = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: "files(id,name,createdTime,size,mimeType)",
        orderBy: "createdTime desc",
        pageSize: 10,
        supportsAllDrives: true,
      })

      testResults.recentFiles = {
        success: true,
        count: filesResponse.data.files?.length || 0,
        files:
          filesResponse.data.files?.map((file) => ({
            name: file.name,
            id: file.id,
            createdTime: file.createdTime,
            size: file.size,
            mimeType: file.mimeType,
          })) || [],
      }
      console.log("✓ File listing completed")
    } catch (listError) {
      testResults.recentFiles = {
        success: false,
        error: listError.message,
      }
    }

    return NextResponse.json({
      success: true,
      message: "Comprehensive Google Drive test completed",
      results: testResults,
    })
  } catch (error: any) {
    console.error("❌ Test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        results: testResults,
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
