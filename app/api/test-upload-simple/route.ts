import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest) {
  // This endpoint used to test Google Drive upload. Drive integration is not used.
  return NextResponse.json({
    success: false,
    disabled: true,
    error: "Upload-simple test disabled (Drive not used).",
  })
}
