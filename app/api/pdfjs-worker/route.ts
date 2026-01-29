import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

/**
 * Worker endpoint (kept for backwards compatibility).
 * We DO NOT actually use a worker (pdf.js runs with disableWorker: true),
 * but older client code may still request this URL.
 */
export async function GET() {
  try {
    const p = path.join(process.cwd(), "public", "pdf.worker.min.js")
    const data = await fs.readFile(p)
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return NextResponse.json({ success: false, message: "worker not found" }, { status: 404 })
  }
}
