import { type NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

type Provider = "auto" | "blob" | "r2"

function asProvider(v: string | null): Provider {
  if (v === "blob" || v === "r2" || v === "auto") return v
  return "auto"
}

function hasR2Env(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE_URL
  )
}

function hasBlobToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

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

async function uploadToR2(file: File, buffer: Buffer) {
  const bucket = requireEnv("R2_BUCKET")
  const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL")

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

  return {
    url: joinUrl(publicBaseUrl, pathname),
    pathname,
    contentType,
    size: buffer.length,
  }
}

async function uploadToBlob(file: File, buffer: Buffer) {
  const safeName = (file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")
  const pathname = `adr-photos/${Date.now()}_${safeName}`
  const contentType = file.type || "image/jpeg"

  const { put } = await import("@vercel/blob")
  const token = process.env.BLOB_READ_WRITE_TOKEN

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType,
    ...(token ? { token } : {}),
  })

  return {
    url: blob.url,
    pathname: blob.pathname || pathname,
    contentType: blob.contentType || contentType,
    size: blob.size || buffer.length,
  }
}

export async function POST(req: NextRequest) {
  try {
    const provider = asProvider(req.nextUrl.searchParams.get("provider") || req.headers.get("x-storage-provider"))

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

    // Provider selection:
    // - explicit 'blob' or 'r2' -> use only that provider (no fallback)
    // - 'auto' -> try Blob if configured, else try R2; if Blob fails (e.g. suspended) fall back to R2 when configured

    const r2Ready = hasR2Env()
    const blobReady = hasBlobToken()

    const tryR2 = async () => {
      if (!r2Ready) throw new Error("R2 is not configured. Set R2_* env vars and R2_PUBLIC_BASE_URL.")
      return uploadToR2(file, buffer)
    }
    const tryBlob = async () => {
      // Without a token, Vercel Blob server-side writes usually fail; surface a clear error.
      if (!blobReady) throw new Error("Blob is not configured. Set BLOB_READ_WRITE_TOKEN.")
      return uploadToBlob(file, buffer)
    }

    let out: { url: string; pathname: string; contentType: string; size: number }

    if (provider === "r2") {
      out = await tryR2()
    } else if (provider === "blob") {
      out = await tryBlob()
    } else {
      // auto
      if (blobReady) {
        try {
          out = await tryBlob()
        } catch (e: any) {
          // If Blob is suspended/misconfigured, fall back to R2 if available
          if (r2Ready) {
            out = await tryR2()
          } else {
            throw e
          }
        }
      } else {
        out = await tryR2()
      }
    }

    return NextResponse.json({ success: true, ...out })
  } catch (error: any) {
    console.error("❌ upload-photo error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to upload photo",
        error: error?.message,
      },
      { status: /suspended/i.test(String(error?.message)) ? 503 : 500 },
    )
  }
}
