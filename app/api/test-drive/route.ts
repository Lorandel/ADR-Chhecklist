import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest) {
  // Drive test intentionally disabled.
  return NextResponse.json({
    success: false,
    disabled: true,
    error: "Drive test disabled (not used).",
  })
}
