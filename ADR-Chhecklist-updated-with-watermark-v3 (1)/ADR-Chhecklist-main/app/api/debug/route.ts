import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Enhanced Debug Endpoint Called ===")

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
          scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.file"],
        })

        const drive = google.drive({ version: "v3", auth })

        // Test 1: Authentication
        console.log("Step 1: Testing authentication...")
        const aboutResponse = await drive.about.get({ fields: "user,storageQuota" })
        console.log("✓ Authenticated as:", aboutResponse.data.user?.emailAddress)
        console.log("Storage quota:", aboutResponse.data.storageQuota)

        // Test 2: Folder access
        console.log("Step 2: Testing folder access...")
        const folderResponse = await drive.files.get({
          fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          fields: "id,name,parents,permissions,owners,capabilities",
        })
        console.log("✓ Folder found:", folderResponse.data.name)
        console.log("Folder owners:", folderResponse.data.owners)
        console.log("Folder capabilities:", folderResponse.data.capabilities)

        // Test 3: List files in folder
        console.log("Step 3: Listing files in folder...")
        const filesResponse = await drive.files.list({
          q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
          fields: "files(id,name,createdTime,size)",
          pageSize: 10,
        })
        console.log("Files in folder:", filesResponse.data.files?.length || 0)
        if (filesResponse.data.files && filesResponse.data.files.length > 0) {
          console.log("Recent files:", filesResponse.data.files.slice(0, 3))
        }

        // Test 4: Check permissions on the folder
        console.log("Step 4: Checking folder permissions...")
        try {
          const permissionsResponse = await drive.permissions.list({
            fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
            fields: "permissions(id,type,role,emailAddress)",
          })
          console.log("Folder permissions:", permissionsResponse.data.permissions)
        } catch (permError) {
          console.log("Could not check permissions:", permError.message)
        }

        // Test 5: Try to create a small test file
        console.log("Step 5: Testing file creation...")
        const testFileName = `test_${Date.now()}.txt`
        const testContent = "This is a test file created by the ADR Checklist system"

        try {
          const createResponse = await drive.files.create({
            requestBody: {
              name: testFileName,
              parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            },
            media: {
              mimeType: "text/plain",
              body: testContent,
            },
            fields: "id,name,webViewLink,size",
          })

          console.log("✓ Test file created:", createResponse.data.name)
          console.log("Test file ID:", createResponse.data.id)
          console.log("Test file size:", createResponse.data.size)

          // Test 6: Delete the test file
          if (createResponse.data.id) {
            await drive.files.delete({ fileId: createResponse.data.id })
            console.log("✓ Test file deleted successfully")
          }

          googleDriveTest = {
            success: true,
            authenticatedAs: aboutResponse.data.user?.emailAddress,
            folderName: folderResponse.data.name,
            folderID: folderResponse.data.id,
            filesInFolder: filesResponse.data.files?.length || 0,
            testFileCreated: createResponse.data.name,
            testFileLink: createResponse.data.webViewLink,
            storageQuota: aboutResponse.data.storageQuota,
            folderOwners: folderResponse.data.owners,
            folderCapabilities: folderResponse.data.capabilities,
          }
        } catch (createError: any) {
          console.error("❌ File creation failed:", createError.message)
          console.error("Error details:", {
            code: createError.code,
            status: createError.status,
            errors: createError.errors,
          })

          googleDriveTest = {
            success: false,
            error: `File creation failed: ${createError.message}`,
            code: createError.code,
            status: createError.status,
            errors: createError.errors,
            authenticatedAs: aboutResponse.data.user?.emailAddress,
            folderName: folderResponse.data.name,
            folderID: folderResponse.data.id,
            filesInFolder: filesResponse.data.files?.length || 0,
            storageQuota: aboutResponse.data.storageQuota,
            folderOwners: folderResponse.data.owners,
            folderCapabilities: folderResponse.data.capabilities,
          }
        }
      } catch (error: any) {
        console.error("❌ Google Drive test failed:", error.message)
        console.error("Full error:", error)

        googleDriveTest = {
          success: false,
          error: error.message,
          code: error.code,
          status: error.status,
          errors: error.errors,
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
