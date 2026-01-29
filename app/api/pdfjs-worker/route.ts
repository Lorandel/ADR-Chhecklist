import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Serve pdf.js classic worker (legacy build) from node_modules.
// This avoids CDN, avoids bundling/terser issues, and works as a classic WebWorker.
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs")
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.js")
    const code = fs.readFileSync(path, "utf8")

    return new NextResponse(code, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "worker not found" }, { status: 500 })
  }
}
