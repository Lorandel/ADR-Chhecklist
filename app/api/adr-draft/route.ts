import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type ChecklistVariant = "full" | "under1000"

function getBearerToken(req: NextRequest): string {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ""
}

function asVariant(v: unknown): ChecklistVariant | null {
  return v === "full" || v === "under1000" ? v : null
}

function cleanDraftId(id: unknown): string {
  return String(id || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80)
}

function draftPath(draftId: string) {
  return `drafts/${draftId}.json`
}

function hasDraftContent(data: any): boolean {
  const hasChecked = (obj: Record<string, boolean> | undefined) => !!obj && Object.values(obj).some(Boolean)
  const hasDate = (d: { month?: string; year?: string } | undefined) => !!d && (!!d.month || !!d.year)
  const hasExpiry = (obj: Record<string, { month?: string; year?: string }> | undefined) =>
    !!obj && Object.values(obj).some((d) => !!d?.month || !!d?.year)
  const hasPhotos = Array.isArray(data?.photos) && data.photos.length > 0
  const hasUnCodes = Array.isArray(data?.unCodes) && data.unCodes.some((v: unknown) => String(v || "").trim())
  const hasOrders = Array.isArray(data?.orderInputs) && data.orderInputs.some((v: unknown) => String(v || "").trim())

  return !!(
    data?.driverName ||
    data?.truckPlate ||
    data?.trailerPlate ||
    hasDate(data?.drivingLicenseDate) ||
    hasDate(data?.adrCertificateDate) ||
    hasDate(data?.truckDocDate) ||
    hasDate(data?.trailerDocDate) ||
    hasChecked(data?.checkedItems) ||
    hasChecked(data?.beforeLoadingChecked) ||
    hasChecked(data?.afterLoadingChecked) ||
    hasExpiry(data?.expiryDates) ||
    data?.remarks ||
    data?.signatureData ||
    data?.inspectorSignatureData ||
    hasUnCodes ||
    hasOrders ||
    hasPhotos
  )
}

async function assertAuthenticated(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return { ok: false as const, status: 401, message: "Missing token" }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return { ok: false as const, status: 401, message: error?.message || "Invalid token" }
  }

  return { ok: true as const, supabase, user: data.user }
}

async function readDraft(auth: Awaited<ReturnType<typeof assertAuthenticated>> & { ok: true }, id: string) {
  const download = await auth.supabase.storage.from("adr-checklists").download(draftPath(id))
  if (download.error || !download.data) {
    const msg = String(download.error?.message || "").toLowerCase()
    if (msg.includes("not found") || msg.includes("404") || msg.includes("does not exist")) return null
    throw new Error(download.error?.message || "Failed to load draft")
  }

  const text = await download.data.text()
  return JSON.parse(text)
}

function getInspectorName(user: any): string {
  const meta: any = user?.user_metadata || {}
  return typeof meta.inspectorName === "string" && meta.inspectorName.trim()
    ? meta.inspectorName.trim()
    : user?.email || "Unknown inspector"
}

function withCurrentLock(payload: any, user: any, dataOverride?: any) {
  const inspectorName = getInspectorName(user)
  const now = new Date().toISOString()
  return {
    ...payload,
    updatedAt: now,
    ownerUserId: user.id,
    inspectorName,
    lockedByUserId: user.id,
    lockedByInspectorName: inspectorName,
    lockedAt: now,
    driverName: typeof dataOverride?.driverName === "string" ? dataOverride.driverName : payload?.driverName || "",
    data: dataOverride || payload?.data || {},
  }
}

function lockedByAnotherUser(draft: any, userId: string): boolean {
  return !!draft?.lockedByUserId && draft.lockedByUserId !== userId
}

async function uploadDraft(auth: Awaited<ReturnType<typeof assertAuthenticated>> & { ok: true }, draftId: string, payload: any) {
  return auth.supabase.storage.from("adr-checklists").upload(draftPath(draftId), Buffer.from(JSON.stringify(payload), "utf8"), {
    contentType: "application/json",
    upsert: true,
  })
}

export async function GET(req: NextRequest) {
  const auth = await assertAuthenticated(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status })

  const requestedDraftId = cleanDraftId(req.nextUrl.searchParams.get("draftId"))
  const requestedVariant = asVariant(req.nextUrl.searchParams.get("variant"))

  try {
    if (requestedDraftId || requestedVariant) {
      const id = requestedDraftId || requestedVariant || ""
      const draft = await readDraft(auth, id)
      return NextResponse.json(
        { success: true, draft: draft?.data && hasDraftContent(draft.data) ? draft : null },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
      )
    }

    const list = await auth.supabase.storage.from("adr-checklists").list("drafts", {
      // Keep this list small enough that the main menu does not download too many draft JSON files.
      limit: 50,
      sortBy: { column: "updated_at", order: "desc" },
    })

    if (list.error) return NextResponse.json({ success: false, message: list.error.message }, { status: 500 })

    const files = (list.data || []).filter((file) => file.name.endsWith(".json"))
    const emptyDraftPaths: string[] = []
    const drafts = (
      await Promise.all(
        files.map(async (file) => {
          try {
            const id = file.name.replace(/\.json$/i, "")
            const draft = await readDraft(auth, id)
            if (!draft?.data || !hasDraftContent(draft.data)) {
              emptyDraftPaths.push(draftPath(id))
              return null
            }
            return { ...draft, draftId: draft.draftId || id }
          } catch {
            return null
          }
        }),
      )
    ).filter(Boolean)

    if (emptyDraftPaths.length > 0) {
      // Best-effort cleanup: empty drafts should not remain visible in the main menu
      // and should not keep being downloaded on every menu load.
      await auth.supabase.storage.from("adr-checklists").remove(emptyDraftPaths).catch(() => null)
    }

    drafts.sort((a: any, b: any) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")))
    return NextResponse.json(
      { success: true, drafts },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to load draft" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status })

  try {
    const body = await req.json()
    const variant = asVariant(body?.variant)
    if (!variant) return NextResponse.json({ success: false, message: "Missing or invalid variant" }, { status: 400 })

    const draftId = cleanDraftId(body?.draftId) || variant
    const action = String(body?.action || "")

    if (action === "takeover") {
      const existing = await readDraft(auth, draftId)
      if (!existing?.data || !hasDraftContent(existing.data)) {
        return NextResponse.json({ success: false, message: "Draft not found or empty" }, { status: 404 })
      }

      const inspectorName = getInspectorName(auth.user)
      const nextData = {
        ...existing.data,
        selectedInspector: inspectorName,
      }
      const payload = withCurrentLock(
        {
          ...existing,
          draftId,
          variant,
        },
        auth.user,
        nextData,
      )

      const up = await uploadDraft(auth, draftId, payload)
      if (up.error) return NextResponse.json({ success: false, message: up.error.message }, { status: 500 })
      return NextResponse.json({ success: true, draft: payload })
    }

    const existing = await readDraft(auth, draftId).catch(() => null)
    if (lockedByAnotherUser(existing, auth.user.id)) {
      return NextResponse.json(
        {
          success: false,
          code: "DRAFT_LOCKED",
          message: `This checklist was taken over by ${existing.lockedByInspectorName || existing.inspectorName || "another user"}.`,
          lockedByUserId: existing.lockedByUserId,
          lockedByInspectorName: existing.lockedByInspectorName || existing.inspectorName || "another user",
        },
        { status: 409 },
      )
    }

    if (!hasDraftContent(body?.data)) {
      await auth.supabase.storage.from("adr-checklists").remove([draftPath(draftId)])
      return NextResponse.json({ success: true, deleted: true, draft: null })
    }

    const inspectorName = getInspectorName(auth.user)
    const data = {
      ...(body?.data || {}),
      selectedInspector: inspectorName,
    }

    const payload = withCurrentLock(
      {
        draftId,
        variant,
      },
      auth.user,
      data,
    )

    const up = await uploadDraft(auth, draftId, payload)

    if (up.error) return NextResponse.json({ success: false, message: up.error.message }, { status: 500 })
    return NextResponse.json({ success: true, draft: payload })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to save draft" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await assertAuthenticated(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const draftId = cleanDraftId(body?.draftId || req.nextUrl.searchParams.get("draftId"))
    const variant = asVariant(body?.variant || req.nextUrl.searchParams.get("variant"))
    const id = draftId || variant
    if (!id) return NextResponse.json({ success: false, message: "Missing draftId or variant" }, { status: 400 })

    const existing = await readDraft(auth, id).catch(() => null)
    if (lockedByAnotherUser(existing, auth.user.id)) {
      return NextResponse.json(
        {
          success: false,
          code: "DRAFT_LOCKED",
          message: `This checklist was taken over by ${existing.lockedByInspectorName || existing.inspectorName || "another user"}.`,
          lockedByInspectorName: existing.lockedByInspectorName || existing.inspectorName || "another user",
        },
        { status: 409 },
      )
    }

    const del = await auth.supabase.storage.from("adr-checklists").remove([draftPath(id)])
    if (del.error) return NextResponse.json({ success: false, message: del.error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Failed to delete draft" }, { status: 500 })
  }
}
