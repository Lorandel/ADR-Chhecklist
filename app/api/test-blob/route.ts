import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  // Safe by default (no side effects). To actually write a test blob, call /api/test-blob?run=1
  const url = new URL(req.url)
  const shouldRun = url.searchParams.get("run") === "1"

  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN

  if (!shouldRun) {
    return NextResponse.json({
      success: true,
      configured: hasToken,
      message: hasToken
        ? "Blob token is configured."
        : "BLOB_READ_WRITE_TOKEN is not set. Configure it in Vercel environment variables.",
      didRun: false,
    })
  }

  if (!hasToken) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: "No blob token found. Set BLOB_READ_WRITE_TOKEN in the environment.",
      didRun: false,
    })
  }

  try {
    const { put, list } = await import("@vercel/blob")

    const testContent = `Test file created at ${new Date().toISOString()}
ADR Checklist Blob test.`
    const testFileName = `test/blob_test_${Date.now()}.txt`

    const blob = await put(testFileName, testContent, {
      access: "public",
      contentType: "text/plain",
    })

    const { blobs } = await list({
      prefix: "test/",
      limit: 5,
    })

    return NextResponse.json({
      success: true,
      configured: true,
      message: "Vercel Blob write test successful!",
      didRun: true,
      testFile: { url: blob.url, size: blob.size, pathname: blob.pathname },
      recentFiles: blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })),
    })
  } catch (error: any) {
    // Return 200 to avoid build/export failures; surface the error in the JSON payload.
    return NextResponse.json({
      success: false,
      configured: hasToken,
      didRun: true,
      error: error?.message || "Blob test failed",
    })
  }
}
