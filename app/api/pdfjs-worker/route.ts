import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export const runtime = "nodejs"

// Serves the PDF.js legacy worker as a classic script (no CDN, no bundling/terser issues).
export async function GET() {
  try {
    const cwd = process.cwd()
    const candidates = [
      path.join(cwd, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.js"),
      path.join(cwd, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js"),
    ]

    let buf: Buffer | null = null
    for (const p of candidates) {
      try {
        buf = await readFile(p)
        break
      } catch {}
    }

    if (!buf) return new NextResponse("pdfjs worker not found", { status: 404 })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (e: any) {
    return new NextResponse(e?.message || "worker error", { status: 500 })
  }
}
