import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    console.log("=== Testing Vercel Blob Storage ===")

    // Import Vercel Blob
    const { put, list } = await import("@vercel/blob")

    // Create a test file
    const testContent = `Test file created at ${new Date().toISOString()}\nThis is a test of Vercel Blob Storage for the ADR Checklist system.`
    const testFileName = `test/blob_test_${Date.now()}.txt`

    console.log("Creating test file:", testFileName)
    console.log("Content length:", testContent.length)

    // Upload test file
    const blob = await put(testFileName, testContent, {
      access: "public",
      contentType: "text/plain",
    })

    console.log("✓ Test file uploaded successfully")
    console.log("Blob URL:", blob.url)
    console.log("Blob size:", blob.size)

    // List recent files
    console.log("Listing recent files...")
    const { blobs } = await list({
      prefix: "test/",
      limit: 5,
    })

    console.log("Recent test files:", blobs.length)

    return NextResponse.json({
      success: true,
      message: "Vercel Blob Storage test successful!",
      testFile: {
        url: blob.url,
        size: blob.size,
        pathname: blob.pathname,
      },
      recentFiles: blobs.map((b) => ({
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    })
  } catch (error: any) {
    console.error("❌ Vercel Blob test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: {
          code: error.code,
          cause: error.cause,
        },
      },
      { status: 500 },
    )
  }
}
