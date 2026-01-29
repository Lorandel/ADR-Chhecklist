import { NextResponse } from "next/server"
import { createRequire } from "module"

export const runtime = "nodejs"

// Serve pdf.js worker from node_modules (no CDN, no bundling issues).
export async function GET() {
  try {
    const require = createRequire(import.meta.url)
    const fs = require("fs") as typeof import("fs")
    const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs")
    const code = fs.readFileSync(workerPath, "utf8")

    return new NextResponse(code, {
      status: 200,
      headers: {
        // IMPORTANT: module scripts/workers require a JS MIME type.
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "worker not found" }, { status: 500 })
  }
}
