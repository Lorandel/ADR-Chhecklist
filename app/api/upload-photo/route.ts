import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json({ success: false, message: "Empty file" }, { status: 400 })
    }

    const { put } = await import("@vercel/blob")

    const safeName = (file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")
    const pathname = `adr-photos/${Date.now()}_${safeName}`

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: file.type || "image/jpeg",
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type || "image/jpeg",
      size: blob.size,
    })
  } catch (error: any) {
    console.error("❌ upload-photo error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to upload photo",
        error: error?.message,
      },
      { status: 500 },
    )
  }
}
