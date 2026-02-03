import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const runtime = "nodejs"

function getR2Env() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL

  const ok = !!(accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl)
  return { ok, accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl }
}

function safeKeyPart(v: string) {
  return (v || "").replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function POST(req: NextRequest) {
  try {
    const env = getR2Env()
    if (!env.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "R2 is not configured",
          missing: {
            R2_ACCOUNT_ID: !!env.accountId,
            R2_ACCESS_KEY_ID: !!env.accessKeyId,
            R2_SECRET_ACCESS_KEY: !!env.secretAccessKey,
            R2_BUCKET: !!env.bucket,
            R2_PUBLIC_BASE_URL: !!env.publicBaseUrl,
          },
        },
        { status: 400 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      filename?: string
      contentType?: string
      folder?: string
    }

    const filename = safeKeyPart(body.filename || "document.pdf")
    const folder = safeKeyPart(body.folder || "pdf")
    const contentType = (body.contentType || "application/pdf").toString()

    const key = `${folder}/${Date.now()}_${filename}`

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.accessKeyId!,
        secretAccessKey: env.secretAccessKey!,
      },
    })

    const command = new PutObjectCommand({
      Bucket: env.bucket!,
      Key: key,
      ContentType: contentType,
    })

    // Short-lived signed URL is enough for an immediate upload.
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 })

    const publicUrl = `${env.publicBaseUrl!.replace(/\/$/, "")}/${key}`
    return NextResponse.json({ success: true, key, signedUrl, publicUrl })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: "Failed to create signed upload URL", error: e?.message },
      { status: 500 },
    )
  }
}
