import { type NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
}

let s3Client: S3Client | null = null
function getS3Client() {
  if (s3Client) return s3Client

  const accountId = requireEnv("R2_ACCOUNT_ID")
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY")

  s3Client = new S3Client({
    region: "auto", // required by SDK but not used by R2
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // Path-style addressing is the most compatible across S3-compatible providers
    forcePathStyle: true,
  })

  return s3Client
}

export async function POST(req: NextRequest) {
  try {
    const bucket = requireEnv("R2_BUCKET")
    const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL")

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

    const safeName = (file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")
    const pathname = `adr-photos/${Date.now()}_${safeName}`

    const contentType = file.type || "image/jpeg"

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: pathname,
        Body: buffer,
        ContentType: contentType,
      }),
    )

    const url = joinUrl(publicBaseUrl, pathname)

    return NextResponse.json({
      success: true,
      url,
      pathname,
      contentType,
      size: buffer.length,
    })
  } catch (error: any) {
    console.error("❌ upload-photo error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to upload photo",
        error: error?.message,
      },
      { status: error?.message?.startsWith("Missing env var") ? 500 : 500 },
    )
  }
}
