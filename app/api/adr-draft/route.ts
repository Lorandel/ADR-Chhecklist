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

function completionPath(draftId: string) {
  return `draft-completions/${draftId}.json`
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function normalizePlate(value: unknown): string {
  return normalizeText(value).replace(/[\s-]+/g, "")
}

function normalizeOrderNumbers(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((v) => String(v || "").trim()).filter(Boolean))).sort()
}

function getDraftOrderNumbers(data: any): string[] {
  return normalizeOrderNumbers([
    ...(Array.isArray(data?.coglasOrderInputs) ? data.coglasOrderInputs : []),
    ...(Array.isArray(data?.internalOrderInputs) ? data.internalOrderInputs : []),
    ...(Array.isArray(data?.orderInputs) ? data.orderInputs : []),
  ])
}

function completedHistoryMatchesDraft(draft: any, historyRow: any): boolean {
  const meta = historyRow?.meta && typeof historyRow.meta === "object" ? historyRow.meta : {}

  // New records carry the exact draft id, so this is the strongest possible match.
  if (cleanDraftId(meta?.draftId) && cleanDraftId(meta?.draftId) === cleanDraftId(draft?.draftId)) return true

  const expectedType = draft?.variant === "full" ? "full" : "reduced"
  if (historyRow?.checklist_type !== expectedType) return false

  const draftUpdatedAt = Date.parse(String(draft?.updatedAt || ""))
  const historyCreatedAt = Date.parse(String(historyRow?.created_at || ""))
  if (Number.isFinite(draftUpdatedAt) && Number.isFinite(historyCreatedAt)) {
    // A completed history entry is normally created seconds after the final draft save.
    // Allow a tiny negative delta for the old autosave race, but never match a draft
    // created much later for the same driver/truck/trailer.
    const completionDelta = historyCreatedAt - draftUpdatedAt
    if (completionDelta < -2 * 60 * 1000 || completionDelta > 30 * 60 * 1000) return false
  }

  const data = draft?.data || {}
  const draftOrders = getDraftOrderNumbers(data)
  const historyOrders = normalizeOrderNumbers(meta?.loadedOrderNumbers)

  if (draftOrders.length > 0) {
    if (historyOrders.length !== draftOrders.length) return false
    if (draftOrders.some((value, index) => value !== historyOrders[index])) return false
  }

  const pairs: Array<[string, string]> = [
    [normalizeText(data?.driverName || draft?.driverName), normalizeText(meta?.driverName)],
    [normalizePlate(data?.truckPlate), normalizePlate(meta?.truckPlate)],
    [normalizePlate(data?.trailerPlate), normalizePlate(meta?.trailerPlate)],
  ]

  let exactMatches = 0
  for (const [draftValue, historyValue] of pairs) {
    if (draftValue && historyValue && draftValue !== historyValue) return false
    if (draftValue && historyValue && draftValue === historyValue) exactMatches += 1
  }

  // Exact order numbers are already a strong identifier. Without them, require all
  // three driver/vehicle fields to match before treating an old draft as completed.
  return draftOrders.length > 0 ? exactMatches >= 1 : exactMatches === 3
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

async function readCompletionMarker(auth: Awaited<ReturnType<typeof assertAuthenticated>> & { ok: true }, id: string) {
  const download = await auth.supabase.storage.from("adr-checklists").download(completionPath(id))
  if (download.error || !download.data) {
    const msg = String(download.error?.message || "").toLowerCase()
    if (msg.includes("not found") || msg.includes("404") || msg.includes("does not exist")) return null
    throw new Error(download.error?.message || "Failed to load completion marker")
  }

  const text = await download.data.text()
  return JSON.parse(text)
}

async function markDraftCompleted(
  auth: Awaited<ReturnType<typeof assertAuthenticated>> & { ok: true },
  draftId: string,
  variant: ChecklistVariant,
) {
  const marker = {
    draftId,
    variant,
    completedAt: new Date().toISOString(),
    completedByUserId: auth.user.id,
    completedByInspectorName: getInspectorName(auth.user),
  }

  return auth.supabase.storage
    .from("adr-checklists")
    .upload(completionPath(draftId), Buffer.from(JSON.stringify(marker), "utf8"), {
      contentType: "application/json",
      upsert: true,
    })
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
      const completed = await readCompletionMarker(auth, id).catch(() => null)
      if (completed) {
        // Best-effort cleanup in case an older client managed to leave the JSON behind.
        await auth.supabase.storage.from("adr-checklists").remove([draftPath(id)]).catch(() => null)
        return NextResponse.json(
          { success: true, draft: null },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
        )
      }

      const draft = await readDraft(auth, id)
      return NextResponse.json(
        { success: true, draft: draft?.data && hasDraftContent(draft.data) ? draft : null },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
      )
    }

    const list = await auth.supabase.storage.from("adr-checklists").list("drafts", {
      // Keep this list small enough that the main menu does not download too many draft JSON files.
      limit: 200,
      sortBy: { column: "updated_at", order: "desc" },
    })

    if (list.error) return NextResponse.json({ success: false, message: list.error.message }, { status: 500 })

    const files = (list.data || []).filter((file) => file.name.endsWith(".json"))

    const completionList = await auth.supabase.storage.from("adr-checklists").list("draft-completions", {
      limit: 1000,
      sortBy: { column: "updated_at", order: "desc" },
    })
    const completedDraftIds = new Set(
      (completionList.data || [])
        .filter((file) => file.name.endsWith(".json"))
        .map((file) => cleanDraftId(file.name.replace(/\.json$/i, "")))
        .filter(Boolean),
    )

    // Compatibility cleanup for drafts completed before completion markers existed.
    // History is kept for 60 days, which is enough to identify and remove those ghosts.
    const history = await auth.supabase
      .from("adr_checklists")
      .select("checklist_type, created_at, meta")
      .order("created_at", { ascending: false })
      .limit(1000)
    const historyRows = history.error ? [] : history.data || []

    const emptyDraftPaths: string[] = []
    const completedDraftPaths: string[] = []
    const completionMarkersToCreate: Array<{ draftId: string; variant: ChecklistVariant }> = []
    const drafts = (
      await Promise.all(
        files.map(async (file) => {
          try {
            const id = cleanDraftId(file.name.replace(/\.json$/i, ""))
            if (!id) return null

            if (completedDraftIds.has(id)) {
              completedDraftPaths.push(draftPath(id))
              return null
            }

            const draft = await readDraft(auth, id)
            if (!draft?.data || !hasDraftContent(draft.data)) {
              emptyDraftPaths.push(draftPath(id))
              return null
            }

            const normalizedDraft = { ...draft, draftId: draft.draftId || id }
            if (historyRows.some((row: any) => completedHistoryMatchesDraft(normalizedDraft, row))) {
              completedDraftPaths.push(draftPath(id))
              const variant = asVariant(normalizedDraft.variant)
              if (variant) completionMarkersToCreate.push({ draftId: id, variant })
              return null
            }

            return normalizedDraft
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

    if (completedDraftPaths.length > 0) {
      // A completed draft must never reappear as "in process". The marker makes this
      // durable even if deleting the old draft object fails temporarily.
      await auth.supabase.storage.from("adr-checklists").remove(completedDraftPaths).catch(() => null)
      await Promise.all(
        completionMarkersToCreate.map(({ draftId, variant }) => markDraftCompleted(auth, draftId, variant).catch(() => null)),
      )
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

    if (action === "complete") {
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

      const marker = await markDraftCompleted(auth, draftId, variant)
      if (marker.error) return NextResponse.json({ success: false, message: marker.error.message }, { status: 500 })

      const del = await auth.supabase.storage.from("adr-checklists").remove([draftPath(draftId)])
      return NextResponse.json({
        success: true,
        deleted: !del.error,
        warning: del.error?.message || undefined,
      })
    }

    if (action === "takeover") {
      const completed = await readCompletionMarker(auth, draftId).catch(() => null)
      if (completed) {
        return NextResponse.json(
          { success: false, code: "DRAFT_COMPLETED", message: "This checklist has already been completed." },
          { status: 410 },
        )
      }

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
    if (!existing) {
      // Only new/missing drafts need the completion-marker lookup. Existing active
      // drafts can autosave without an extra Storage request on every keystroke.
      const completed = await readCompletionMarker(auth, draftId).catch(() => null)
      if (completed) {
        return NextResponse.json(
          { success: false, code: "DRAFT_COMPLETED", message: "This checklist has already been completed." },
          { status: 410 },
        )
      }
    }

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
          lockedByUserId: existing.lockedByUserId,
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
