import { type NextRequest, NextResponse } from "next/server"
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

function hasR2Env(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE_URL
  )
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

let s3Client: S3Client | null = null
function getS3Client(): S3Client {
  if (s3Client) return s3Client
  const accountId = requireEnv("R2_ACCOUNT_ID")
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY")

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return s3Client
}

export async function GET(req: NextRequest) {
  // Safe by default. To actually write a test object, call /api/test-r2?run=1
  const url = new URL(req.url)
  const shouldRun = url.searchParams.get("run") === "1"

  const configured = hasR2Env()

  if (!shouldRun) {
    return NextResponse.json({
      success: true,
      configured,
      didRun: false,
      message: configured
        ? "R2 is configured (R2_* env vars present)."
        : "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL.",
    })
  }

  if (!configured) {
    return NextResponse.json({
      success: false,
      configured: false,
      didRun: false,
      error: "R2 is not configured. Missing one or more R2_* env vars.",
    })
  }

  try {
    const bucket = requireEnv("R2_BUCKET")
    const key = `test/r2_test_${Date.now()}.txt`
    const body = `Test file created at ${new Date().toISOString()}
ADR Checklist R2 test.
`

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      })
    )

    // Cleanup to avoid filling storage
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )

    return NextResponse.json({
      success: true,
      configured: true,
      didRun: true,
      message: "R2 write test successful (wrote and deleted a test object).",
      key,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      configured: true,
      didRun: true,
      error: error?.message || "R2 test failed",
    })
  }
}
