import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function getBearerToken(req: NextRequest): string {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ""
}

async function assertAdmin(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return { ok: false, status: 401, message: "Missing token" }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, message: (error as any)?.message || "Invalid token" }

  const role = (data.user.user_metadata as any)?.role
  if (role !== "admin") return { ok: false, status: 403, message: "Forbidden" }

  return { ok: true as const, supabase, user: data.user }
}

function splitEmails(raw: string): string[] {
  return (raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

async function listAllUsers(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const users: any[] = []
  let page = 1
  const perPage = 200
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data?.users || []
    users.push(...batch)
    if (batch.length < perPage) break
    page += 1
  }
  return users
}

export async function GET(req: NextRequest) {
  const a = await assertAdmin(req)
  if (!a.ok) return NextResponse.json({ success: false, message: a.message }, { status: a.status })

  try {
    const all = await listAllUsers(a.supabase)
    const nonAdmins = all.filter((u) => ((u.user_metadata as any)?.role || "user") !== "admin")

    const targets = nonAdmins.map((u) => {
      const meta: any = u.user_metadata || {}
      return {
        id: u.id,
        email: u.email,
        inspectorEmail: String(meta.inspectorEmail || "").trim(),
      }
    })

    const missingInspectorEmailCount = targets.filter((t) => !t.inspectorEmail).length
    const withRecipientsCount = targets.filter((t) => splitEmails(t.inspectorEmail).length > 0).length

    return NextResponse.json({
      success: true,
      totalUsers: all.length,
      targetUsers: targets.length,
      withRecipientsCount,
      missingInspectorEmailCount,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const a = await assertAdmin(req)
  if (!a.ok) return NextResponse.json({ success: false, message: a.message }, { status: a.status })

  const hasUser = !!process.env.GMAIL_USER
  const hasPassword = !!process.env.GMAIL_APP_PASSWORD
  if (!hasUser || !hasPassword) {
    return NextResponse.json(
      { success: false, message: "Missing GMAIL_USER or GMAIL_APP_PASSWORD." },
      { status: 500 },
    )
  }

  try {
    const nodemailerMod: any = await import("nodemailer")
    const nodemailer = nodemailerMod?.default ?? nodemailerMod

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })

    await transporter.verify()

    const all = await listAllUsers(a.supabase)
    const nonAdmins = all.filter((u) => ((u.user_metadata as any)?.role || "user") !== "admin")

    let sentCount = 0
    let missingInspectorEmailCount = 0
    const errors: Array<{ userId: string; email?: string; inspectorEmail?: string; error: string }> = []

    for (const u of nonAdmins) {
      const meta: any = u.user_metadata || {}
      const inspectorEmail = String(meta.inspectorEmail || "").trim()
      const recipients = splitEmails(inspectorEmail)

      if (recipients.length === 0) {
        missingInspectorEmailCount += 1
        continue
      }

      try {
        await transporter.sendMail({
          from: `"ADR Checklist Test" <${process.env.GMAIL_USER}>`,
          to: recipients.join(", "),
          subject: "ADR Checklist - Test Email",
          text:
            "This is a test email from the ADR Checklist system. If you received this, delivery to your configured Inspector email works.",
          html:
            "<b>This is a test email from the ADR Checklist system.</b><br/><br/>If you received this, delivery to your configured Inspector email works.",
        })
        sentCount += 1
      } catch (e: any) {
        errors.push({
          userId: u.id,
          email: u.email,
          inspectorEmail,
          error: e?.message || "Send failed",
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalUsers: all.length,
      targetUsers: nonAdmins.length,
      sentCount,
      missingInspectorEmailCount,
      errors,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed" }, { status: 500 })
  }
}
