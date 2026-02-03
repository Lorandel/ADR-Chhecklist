import { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function textLine(s: string) {
  return `${s}\n`
}

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ""
}

async function requireAdmin(req: NextRequest) {
  const token = getBearer(req)
  if (!token) throw new Error("Missing Authorization Bearer token")

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) throw new Error(error?.message || "Failed to read user")

  const role = (data.user.user_metadata as any)?.role
  if (role !== "admin") throw new Error("Unauthorized")

  return { user: data.user, token }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  const url = new URL(req.url)
  const doSendEmail = url.searchParams.get("send") === "1"

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (line: string) => controller.enqueue(encoder.encode(textLine(line)))
      const writeErr = (line: string) => controller.enqueue(encoder.encode(textLine(`ERROR: ${line}`)))

      write("=== ADR System Check ===")
      write(`Time: ${new Date().toISOString()}`)

      try {
        const { user } = await requireAdmin(req)
        const meta: any = user.user_metadata || {}
        const testRecipient = (meta.inspectorEmail as string) || process.env.GMAIL_USER || ""
        write(`Admin: ${user.email}`)
        write(`Test recipient: ${testRecipient || "(missing)"}`)

        // ---- Env checks ----
        write("\n[1] Environment")
        const env = {
          GMAIL_USER: !!process.env.GMAIL_USER,
          GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
          BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
          R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
          R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
          R2_BUCKET: !!process.env.R2_BUCKET,
          R2_PUBLIC_BASE_URL: !!process.env.R2_PUBLIC_BASE_URL,
          SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        }
        write(JSON.stringify(env, null, 2))

        // ---- Email verify ----
        write("\n[2] Email verify")
        if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
          writeErr("Missing GMAIL_USER / GMAIL_APP_PASSWORD")
        } else {
          const nodemailerMod: any = await import("nodemailer")
          const nodemailer = nodemailerMod?.default ?? nodemailerMod
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          })
          await transporter.verify()
          write("OK: transporter.verify")
        }

        // ---- R2 presign + upload + email pipeline ----
        write("\n[3] Blob test")
        try {
          const blobCheck = await fetch(new URL("/api/test-blob", req.url), { cache: "no-store" })
          const blobData = await blobCheck.json().catch(() => ({}))
          if (!blobCheck.ok || blobData?.success === false) {
            writeErr(blobData?.error || blobData?.message || `Blob check failed (HTTP ${blobCheck.status})`)
          } else {
            write("OK: /api/test-blob")
          }

          // Write test is optional because it has side effects.
          if (doSendEmail) {
            const blobWrite = await fetch(new URL("/api/test-blob?run=1", req.url), { cache: "no-store" })
            const blobWriteData = await blobWrite.json().catch(() => ({}))
            if (!blobWrite.ok || blobWriteData?.success === false) {
              writeErr(blobWriteData?.error || blobWriteData?.message || `Blob write failed (HTTP ${blobWrite.status})`)
            } else {
              write("OK: /api/test-blob?run=1")
            }
          } else {
            write("SKIP: blob write test (send=0)")
          }
        } catch (e: any) {
          writeErr(e?.message || "Blob test failed")
        }

        write("\n[4] R2 presign/upload test")
        let pdfUrl: string | null = null
        if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET || !env.R2_PUBLIC_BASE_URL) {
          write("SKIP: R2 not configured")
        } else {
          const presign = await fetch(new URL("/api/presign-r2", req.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: "system_test.pdf", contentType: "application/pdf", folder: "pdf" }),
          })
          const presignData = await presign.json().catch(() => ({}))
          if (!presign.ok || !presignData?.success) {
            throw new Error(presignData?.message || `presign failed (HTTP ${presign.status})`)
          }

          // tiny valid-ish PDF bytes
          const pdfBytes = encoder.encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")
          const put = await fetch(presignData.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: pdfBytes,
          })
          if (!put.ok) throw new Error(`R2 PUT failed (HTTP ${put.status})`)
          pdfUrl = presignData.publicUrl
          write(`OK: uploaded PDF -> ${pdfUrl}`)
        }

        // ---- Send email with pdfUrl (optional) ----
        write("\n[5] Send-email pipeline")
        if (!doSendEmail) {
          write("SKIP: send=0 (append ?send=1 to actually send)")
        } else if (!pdfUrl) {
          writeErr("Cannot send pipeline email: no pdfUrl (configure R2)")
        } else if (!testRecipient) {
          writeErr("No test recipient (set admin inspectorEmail or GMAIL_USER)")
        } else {
          const send = await fetch(new URL("/api/send-email", req.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inspectorName: "System Test",
              inspectorEmail: testRecipient,
              driverName: "System Test",
              truckPlate: "TEST",
              trailerPlate: "TEST",
              inspectionDate: new Date().toISOString().slice(0, 10),
              pdfUrl,
              photos: [],
              variant: "reduced",
              checklistHash: `system_test_${Date.now()}`,
              meta: { systemTest: true },
            }),
          })
          const sendData = await send.json().catch(() => ({}))
          if (!send.ok || !sendData?.success) {
            throw new Error(sendData?.message || `send-email failed (HTTP ${send.status})`)
          }
          write("OK: send-email succeeded")
        }

        write("\n=== DONE ===")
      } catch (e: any) {
        writeErr(e?.message || "System test failed")
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
