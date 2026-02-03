import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { put as blobPut, del as blobDel } from "@vercel/blob"
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import nodemailer from "nodemailer"

export const runtime = "nodejs"

function getBearerToken(req: NextRequest): string {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ""
}

async function assertAdmin(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return { ok: false as const, status: 401, message: "Missing token" }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { ok: false as const, status: 401, message: "Invalid token" }
  const role = (data.user.user_metadata as any)?.role
  if (role !== "admin") return { ok: false as const, status: 403, message: "Forbidden" }

  return { ok: true as const, supabase, user: data.user }
}

function nowIso() {
  return new Date().toISOString()
}

function envBool(v?: string | null) {
  return !!(v && String(v).trim().length > 0)
}

function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) return null

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

async function runBlobTest(write: (s: string) => void) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!envBool(token)) {
    write("[SKIP] Blob: BLOB_READ_WRITE_TOKEN not set")
    return
  }

  const key = `test/system_test_${Date.now()}.txt`
  write(`[INFO] Blob: writing ${key}`)
  try {
    const res = await blobPut(key, `system-test ${nowIso()}`, {
      access: "public",
      contentType: "text/plain",
      token,
    })
    write(`[OK] Blob: put success (${res.url})`)
    try {
      await blobDel(res.url, { token })
      write("[OK] Blob: delete success")
    } catch (e: any) {
      write(`[WARN] Blob: delete failed: ${e?.message || String(e)}`)
    }
  } catch (e: any) {
    write(`[FAIL] Blob: put failed: ${e?.message || String(e)}`)
  }
}

async function runR2Test(write: (s: string) => void) {
  const bucket = process.env.R2_BUCKET
  const client = createR2Client()
  if (!client || !bucket) {
    write("[SKIP] R2: R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET not set")
    return
  }

  const key = `test/system_test_${Date.now()}.txt`
  write(`[INFO] R2: writing s3://${bucket}/${key}`)
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(`system-test ${nowIso()}`),
        ContentType: "text/plain",
      }),
    )
    write("[OK] R2: put success")
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      write("[OK] R2: delete success")
    } catch (e: any) {
      write(`[WARN] R2: delete failed: ${e?.message || String(e)}`)
    }
  } catch (e: any) {
    write(`[FAIL] R2: put failed: ${e?.message || String(e)}`)
  }
}

async function runSupabaseAdminTest(write: (s: string) => void) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!envBool(url) || !envBool(serviceKey)) {
    write("[SKIP] Supabase: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    return
  }
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) {
      write(`[FAIL] Supabase: listUsers failed: ${error.message}`)
      return
    }
    write(`[OK] Supabase: listUsers ok (sample count=${data?.users?.length ?? 0})`)
  } catch (e: any) {
    write(`[FAIL] Supabase: ${e?.message || String(e)}`)
  }
}

async function runEmailConfigTest(write: (s: string) => void) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!envBool(user) || !envBool(pass)) {
    write("[SKIP] Email: GMAIL_USER or GMAIL_APP_PASSWORD not set")
    return
  }
  write("[INFO] Email: verifying SMTP auth")
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    })
    await transporter.verify()
    write("[OK] Email: transporter.verify ok")
  } catch (e: any) {
    write(`[FAIL] Email: verify failed: ${e?.message || String(e)}`)
  }
}

export async function GET(req: NextRequest) {
  const auth = await assertAdmin(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status })
  }

  const url = new URL(req.url)
  const mode = (url.searchParams.get("mode") || "all").toLowerCase()

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (line: string) => {
        controller.enqueue(encoder.encode(line + "\n"))
      }

      ;(async () => {
        write(`=== System Test Started (${nowIso()}) ===`)
        write(`[INFO] mode=${mode}`)

        if (mode === "all" || mode === "blob") await runBlobTest(write)
        if (mode === "all" || mode === "r2") await runR2Test(write)
        if (mode === "all" || mode === "supabase") await runSupabaseAdminTest(write)
        if (mode === "all" || mode === "email") await runEmailConfigTest(write)

        write(`=== System Test Finished (${nowIso()}) ===`)
        controller.close()
      })().catch((e) => {
        write(`[FATAL] ${e?.message || String(e)}`)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
