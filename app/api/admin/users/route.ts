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
  if (error || !data?.user) return { ok: false, status: 401, message: "Invalid token" }
  const role = (data.user.user_metadata as any)?.role
  if (role !== "admin") return { ok: false, status: 403, message: "Forbidden" }

  return { ok: true as const, supabase, user: data.user }
}

type CreateBody = {
  action: "create"
  username: string
  password: string
  role?: "admin" | "user"
  inspectorName?: string
  inspectorColor?: string
  inspectorEmail?: string
}

type UpdateBody = {
  action: "update"
  userId: string
  role?: "admin" | "user"
  inspectorName?: string
  inspectorColor?: string
  inspectorEmail?: string
  newPassword?: string
}

const normalizeEmailForAccount = (usernameOrEmail: string) => {
  const raw = (usernameOrEmail || "").trim()
  if (!raw) return ""
  if (raw.includes("@")) return raw
  return `${raw}@adr.local`
}

export async function GET(req: NextRequest) {
  const a = await assertAdmin(req)
  if (!a.ok) return NextResponse.json({ success: false, message: a.message }, { status: a.status })

  try {
    const { data, error } = await a.supabase.auth.admin.listUsers({ perPage: 200 })
    if (error) throw error

    const users = (data.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      user_metadata: u.user_metadata,
    }))

    return NextResponse.json({ success: true, users })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const a = await assertAdmin(req)
  if (!a.ok) return NextResponse.json({ success: false, message: a.message }, { status: a.status })

  try {
    const body = (await req.json()) as CreateBody | UpdateBody

    if (body.action === "create") {
      const email = normalizeEmailForAccount(body.username)
      const password = (body.password || "").trim()
      if (!email || !password) return NextResponse.json({ success: false, message: "Missing username/password" }, { status: 400 })

      const role = body.role === "admin" ? "admin" : "user"
      const user_metadata = {
        role,
        inspectorName: (body.inspectorName || "").trim(),
        inspectorColor: (body.inspectorColor || "").trim(),
        inspectorEmail: (body.inspectorEmail || "").trim(),
      }

      const { data, error } = await a.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata,
      })
      if (error) throw error

      return NextResponse.json({ success: true, user: { id: data.user?.id, email: data.user?.email } })
    }

    if (body.action === "update") {
      const userId = (body.userId || "").trim()
      if (!userId) return NextResponse.json({ success: false, message: "Missing userId" }, { status: 400 })

      const patchMeta: Record<string, any> = {}
      if (body.role) patchMeta.role = body.role
      if (typeof body.inspectorName === "string") patchMeta.inspectorName = body.inspectorName.trim()
      if (typeof body.inspectorColor === "string") patchMeta.inspectorColor = body.inspectorColor.trim()
      if (typeof body.inspectorEmail === "string") patchMeta.inspectorEmail = body.inspectorEmail.trim()

      const updatePayload: any = {}
      if (Object.keys(patchMeta).length) updatePayload.user_metadata = patchMeta
      if (body.newPassword && body.newPassword.trim()) updatePayload.password = body.newPassword.trim()

      const { data, error } = await a.supabase.auth.admin.updateUserById(userId, updatePayload)
      if (error) throw error

      return NextResponse.json({ success: true, user: { id: data.user?.id, email: data.user?.email } })
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed" }, { status: 500 })
  }
}
