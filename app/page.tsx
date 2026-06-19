// app/page.tsx
"use client"

import { useEffect, useState } from "react"
import ADRChecklist, { type ChecklistVariant } from "@/components/AdrChecklist"
import AdrHistoryModal from "@/components/AdrHistoryModal"
import AdminPanelModal from "@/components/AdminPanelModal"
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider"
import LoginGate from "@/components/auth/LoginGate"
import { Button } from "@/components/ui/button"

type InProgressDraft = {
  draftId: string
  variant: ChecklistVariant
  inspectorName: string
  driverName?: string
  updatedAt: string
  ownerUserId?: string
  data?: Record<string, unknown>
}

function HomePageInner() {
  const { role, signOut, inspectorName, session } = useAuth()

  // Keep the user on the same checklist page after refresh (per user).
  const userId = (session as any)?.user?.id || (session as any)?.user?.sub || "anonymous"
  const activeVariantKey = `adrActiveVariant_${userId}`
  const activeDraftKey = `adrActiveDraft_${userId}`

  // On some devices/browsers the first paint can happen before localStorage is read,
  // which briefly shows the menu before returning to the checklist. We avoid that by
  // rendering a white placeholder until we've checked the saved variant.
  const [variant, setVariant] = useState<ChecklistVariant | null | "loading">("loading")
  const [activeDraftId, setActiveDraftId] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [inProgressDrafts, setInProgressDrafts] = useState<InProgressDraft[]>([])
  const [showNewChecklistOptions, setShowNewChecklistOptions] = useState(false)

  // Load persisted active variant on mount (per user).
  useEffect(() => {
    if (!session) return
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem(activeVariantKey)
    const savedDraftId = window.localStorage.getItem(activeDraftKey) || ""

    try {
      const parsed = saved ? JSON.parse(saved) : null
      if ((parsed?.variant === "full" || parsed?.variant === "under1000") && parsed?.draftId) {
        setActiveDraftId(String(parsed.draftId))
        setVariant(parsed.variant)
        return
      }
    } catch {
      // older saved value format, handled below
    }

    if (saved === "full" || saved === "under1000") {
      setActiveDraftId(savedDraftId || `${saved}-${userId}`)
      setVariant(saved as ChecklistVariant)
    } else {
      setActiveDraftId("")
      setVariant(null)
    }
  }, [session, activeVariantKey, activeDraftKey, userId])

  // Persist active variant whenever it changes.
  useEffect(() => {
    if (!session) return
    if (typeof window === "undefined") return
    if (variant === "loading") return
    if (variant && activeDraftId) {
      window.localStorage.setItem(activeVariantKey, JSON.stringify({ variant, draftId: activeDraftId }))
      window.localStorage.setItem(activeDraftKey, activeDraftId)
    } else {
      window.localStorage.removeItem(activeVariantKey)
      window.localStorage.removeItem(activeDraftKey)
    }
  }, [session, activeVariantKey, activeDraftKey, variant, activeDraftId])

  const createDraftId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  const hasDraftContent = (data: any) => {
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

  const normalizeDraft = (draft: any, fallbackId: string): InProgressDraft | null => {
    const variant = draft?.variant === "full" || draft?.variant === "under1000" ? draft.variant : null
    const data = draft?.data && typeof draft.data === "object" ? draft.data : null
    if (!variant || !data || !hasDraftContent(data)) return null

    return {
      draftId: String(draft?.draftId || data?.draftId || fallbackId),
      variant,
      inspectorName: draft?.inspectorName || data?.selectedInspector || "Unknown inspector",
      driverName: draft?.driverName || data?.driverName || "",
      updatedAt: draft?.updatedAt || "",
      ownerUserId: draft?.ownerUserId,
      data,
    }
  }

  const readLocalDrafts = () => {
    if (typeof window === "undefined") return [] as InProgressDraft[]

    const drafts: InProgressDraft[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith("adrSharedChecklistData_")) continue

      try {
        const raw = window.localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        const fallbackId = key.replace("adrSharedChecklistData_", "")
        const draft = normalizeDraft(parsed, fallbackId)
        if (draft) drafts.push(draft)
      } catch {
        // ignore invalid draft entries
      }
    }

    // Legacy compatibility: older versions used one shared key per variant.
    ;(["under1000", "full"] as ChecklistVariant[]).forEach((v) => {
      try {
        const raw = window.localStorage.getItem(`adrSharedChecklistData_${v}`)
        if (!raw) return
        const parsed = JSON.parse(raw)
        const draft = normalizeDraft(parsed, v)
        if (draft && !drafts.some((d) => d.draftId === draft.draftId)) drafts.push(draft)
      } catch {
        // ignore
      }
    })

    return drafts.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }

  const loadInProgressDrafts = async () => {
    if (!session || typeof window === "undefined") return

    let drafts = readLocalDrafts()

    // Supabase-backed shared drafts allow another logged-in user/device to take over the checklist.
    if (session.access_token) {
      try {
        const res = await fetch("/api/adr-draft", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(json?.drafts)) {
          const remoteDrafts = json.drafts
            .map((d: any) => normalizeDraft(d, d?.draftId || d?.variant || "remote"))
            .filter(Boolean) as InProgressDraft[]

          const byId = new Map<string, InProgressDraft>()
          drafts.forEach((d) => byId.set(d.draftId, d))
          remoteDrafts.forEach((d) => byId.set(d.draftId, d))
          drafts = Array.from(byId.values()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        }
      } catch {
        // keep local drafts if remote loading fails
      }
    }

    setInProgressDrafts(drafts)
    if (drafts.length === 0) setShowNewChecklistOptions(true)
  }

  useEffect(() => {
    if (!session || variant !== null) return
    void loadInProgressDrafts()

    const onStorage = () => void loadInProgressDrafts()
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, variant])

  const startNewChecklist = (nextVariant: ChecklistVariant) => {
    if (typeof window === "undefined") return
    const nextDraftId = createDraftId()
    window.localStorage.removeItem(`adrChecklistData_${nextVariant}_${userId}_${nextDraftId}`)
    window.localStorage.setItem(activeVariantKey, JSON.stringify({ variant: nextVariant, draftId: nextDraftId }))
    window.localStorage.setItem(activeDraftKey, nextDraftId)
    setActiveDraftId(nextDraftId)
    setVariant(nextVariant)
  }

  const takeOverDraft = (draft: InProgressDraft) => {
    if (typeof window === "undefined") return
    if (!draft.data) return

    const targetStorageKey = `adrChecklistData_${draft.variant}_${userId}_${draft.draftId}`
    const nextData = {
      ...draft.data,
      selectedInspector: inspectorName || (draft.data as any).selectedInspector || "",
    }
    window.localStorage.setItem(targetStorageKey, JSON.stringify(nextData))
    window.localStorage.setItem(activeVariantKey, JSON.stringify({ variant: draft.variant, draftId: draft.draftId }))
    window.localStorage.setItem(activeDraftKey, draft.draftId)
    setActiveDraftId(draft.draftId)
    setVariant(draft.variant)
  }

  if (variant === "loading") {
    return <div className="min-h-[100vh] bg-white" />
  }

  if (variant) {
    return (
      <ADRChecklist
        variant={variant}
        draftId={activeDraftId}
        onBack={() => {
          // Clear the persisted "active" screen only when the user explicitly goes back.
          setActiveDraftId("")
          setVariant(null)
          void loadInProgressDrafts()
        }}
      />
    )
  }

  return (
    <div className="min-h-[100vh] flex items-center justify-center p-6 bg-white relative">
      <div className="fixed top-3 left-3 right-3 z-50 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-gray-200 bg-white/90 p-2 backdrop-blur md:absolute md:top-4 md:left-auto md:right-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
        {inspectorName && <div className="text-xs text-gray-600 mr-2">Logged as <span className="font-semibold">{inspectorName}</span></div>}

        {role === "admin" && (
          <Button variant="outline" className="bg-transparent" onClick={() => setAdminOpen(true)}>
            Admin
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          className="bg-transparent"
          onClick={() => setHistoryOpen(true)}
        >
          ADR Checklists History
        </Button>

        <Button
          type="button"
          variant="outline"
          className="bg-transparent"
          onClick={async () => {
            setHistoryOpen(false)
            setAdminOpen(false)
            await signOut()
          }}
        >
          Sign out
        </Button>
      </div>

      <AdrHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <AdminPanelModal open={adminOpen} onClose={() => setAdminOpen(false)} />

      <div className="w-full max-w-3xl">
        {/* Watermark above title (original image opacity) */}
        <div className="flex items-center justify-center mb-6">
          <img src="/images/albias-watermark.png" alt="Alblas watermark" className="w-56 md:w-72" />
        </div>

        <h1 className="text-3xl font-bold text-center mb-10">ADR Checklist</h1>

        {inProgressDrafts.length > 0 && (
          <div className="mb-8 space-y-3">
            {inProgressDrafts.map((draft) => (
              <div key={draft.draftId} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-amber-900">
                      {draft.variant === "full" ? "Full Checklist" : "Reduced Checklist"} is in process
                    </div>
                    <div className="text-sm text-amber-800">
                      By user: <span className="font-semibold">{draft.inspectorName}</span>
                      {draft.driverName ? (
                        <> • Driver: <span className="font-semibold">{draft.driverName}</span></>
                      ) : null}
                      {draft.updatedAt ? ` • ${new Date(draft.updatedAt).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <Button type="button" onClick={() => takeOverDraft(draft)}>
                    Take over and continue
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6 flex justify-center">
          <Button
            type="button"
            onClick={() => setShowNewChecklistOptions((prev) => !prev)}
            className="min-w-[180px]"
          >
            New Checklist
          </Button>
        </div>

        {(showNewChecklistOptions || inProgressDrafts.length === 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => startNewChecklist("under1000")}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-10 shadow-xl transition duration-200 hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black min-h-[170px] flex items-center justify-center text-center"
          >
            <div className="relative z-10">
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Under 1000 pts</div>
              <div className="text-2xl font-bold text-gray-900">Reduced Checklist</div>
              <div className="mt-3 text-sm text-gray-600">Simplified equipment &amp; signage requirements</div>
            </div>
            <span className="pointer-events-none absolute -right-14 -bottom-14 h-44 w-44 rounded-full bg-gray-100 transition group-hover:scale-110" />
          </button>

          <button
            type="button"
            onClick={() => startNewChecklist("full")}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-10 shadow-xl transition duration-200 hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black min-h-[170px] flex items-center justify-center text-center"
          >
            <div className="relative z-10">
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">1000+ pts</div>
              <div className="text-2xl font-bold text-gray-900">Full Checklist</div>
              <div className="mt-3 text-sm text-gray-600">Complete ADR requirements and verification</div>
            </div>
            <span className="pointer-events-none absolute -right-14 -bottom-14 h-44 w-44 rounded-full bg-gray-100 transition group-hover:scale-110" />
          </button>
        </div>
        )}

        <p className="text-sm text-gray-600 text-center mt-8">
          Choose the correct option based on the ADR points planned for loading.
        </p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <AuthProvider>
      <LoginGate>
        <HomePageInner />
      </LoginGate>
    </AuthProvider>
  )
}
