"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type HistoryItem = {
  id: string
  checklist_type: "reduced" | "full"
  checklist_hash: string
  file_path: string
  created_at: string
  expires_at: string
  email_sent: boolean
  meta?: Record<string, any> | string | null
  downloadUrl?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
}

type Role = "guest" | "admin" | null

export default function AdrHistoryModal({ open, onClose }: Props) {
  const [role, setRole] = useState<Role>(null)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [refreshTick, setRefreshTick] = useState(0)

  const [search, setSearch] = useState("")

  // Preview (render PDF inside the app)
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const pdfArrayBufferRef = useRef<ArrayBuffer | null>(null)
  const renderSeq = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const safeMeta = (meta: any): Record<string, any> => {
    if (!meta) return {}
    if (typeof meta === "object") return meta as Record<string, any>
    if (typeof meta === "string") {
      try {
        const parsed = JSON.parse(meta)
        return parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {}
      } catch {
        return {}
      }
    }
    return {}
  }

  const matchesSearch = (it: HistoryItem, qRaw: string) => {
    const q = (qRaw || "").trim().toLowerCase()
    if (!q) return true
    const m = safeMeta(it.meta)
    const driver = String(m.driverName ?? m.driver_name ?? "").toLowerCase()
    const truck = String(m.truckPlate ?? m.truck_plate ?? m.truckNumber ?? m.truck_number ?? "").toLowerCase()
    const trailer = String(m.trailerPlate ?? m.trailer_plate ?? m.trailerNumber ?? m.trailer_number ?? "").toLowerCase()
    const inspector = String(m.inspectorName ?? m.inspector_name ?? "").toLowerCase()
    const hash = String(it.checklist_hash ?? "").toLowerCase()
    return (
      driver.includes(q) ||
      truck.includes(q) ||
      trailer.includes(q) ||
      inspector.includes(q) ||
      hash.includes(q)
    )
  }

  const formatDDMMYYYY = (iso: string) => {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = String(d.getFullYear())
    return `${dd}-${mm}-${yyyy}`
  }

  const itemLabel = (it: HistoryItem) => {
    const m = safeMeta(it.meta)
    const driver = String(m.driverName ?? m.driver_name ?? "").trim()
    const inspector = String(m.inspectorName ?? m.inspector_name ?? "").trim()

    let date = String(m.inspectionDate ?? m.inspection_date ?? "").trim()
    if (!date && it.created_at) date = formatDDMMYYYY(it.created_at)

    const base = driver || it.checklist_hash.slice(0, 10)
    const withInspector = inspector ? `${base} (inspector: ${inspector})` : base
    return date ? `${withInspector} • ${date}` : withInspector
  }

  const reduced = useMemo(
    () => items.filter((i) => i.checklist_type === "reduced").filter((i) => matchesSearch(i, search)),
    [items, search],
  )
  const full = useMemo(
    () => items.filter((i) => i.checklist_type === "full").filter((i) => matchesSearch(i, search)),
    [items, search],
  )

  useEffect(() => {
    if (!open) {
      setRole(null)
      setUser("")
      setPass("")
      setError(null)
      setItems([])
      setSearch("")
      setPreviewOpen(false)
      setPreviewItem(null)
      setPreviewError(null)
      setZoom(1)
      pdfArrayBufferRef.current = null
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || !role) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/adr-history?ts=${Date.now()}`, { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || `Failed to load history (${res.status})`)
        }
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load history")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, role, refreshTick])

  const close = () => {
    onClose()
  }

  const doLogin = () => {
    setError(null)
    if (user.trim() === "admin" && pass.trim() === "admin") {
      setRole("admin")
      return
    }
    setError("Invalid credentials")
  }

  const seeAsGuest = () => {
    setError(null)
    setRole("guest")
  }

  const onDelete = async (it: HistoryItem) => {
    if (role !== "admin") return
    const ok = confirm("Delete this ZIP from history?")
    if (!ok) return

    try {
      setLoading(true)
      const res = await fetch("/api/adr-history/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, user: "admin", password: "admin" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Delete failed (${res.status})`)
      }
      setRefreshTick((x) => x + 1)
    } catch (e: any) {
      setError(e?.message || "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  const onDownloadZip = (it: HistoryItem) => {
    if (!it.downloadUrl) return
    window.open(it.downloadUrl, "_blank", "noopener,noreferrer")
  }

  const renderPdfToCanvas = useCallback(
    async (buf: ArrayBuffer, z: number) => {
      const seq = ++renderSeq.current
      setPreviewLoading(true)
      setPreviewError(null)

      try {
        const pdfjs: any = await import("pdfjs-dist/build/pdf")
        
        pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdfjs-worker"
// Use CDN worker to avoid bundling issues on Next/Vercel
        const loadingTask = pdfjs.getDocument({ data: buf })
        const pdf = await loadingTask.promise
        // Keep single page (your PDF is single page)
        const page = await pdf.getPage(1)

        const viewport = page.getViewport({ scale: z * 1.0 })
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // If a newer render started, stop
        if (seq !== renderSeq.current) return

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        await page.render({ canvasContext: ctx, viewport }).promise
      } catch (e: any) {
        setPreviewError(e?.message || "Failed to render PDF")
      } finally {
        setPreviewLoading(false)
      }
    },
    [],
  )

  const openPreview = async (it: HistoryItem) => {
    setPreviewItem(it)
    setPreviewOpen(true)
    setPreviewError(null)
    setZoom(1)
    pdfArrayBufferRef.current = null

    try {
      setPreviewLoading(true)
      const res = await fetch(`/api/adr-history/preview?id=${encodeURIComponent(it.id)}&ts=${Date.now()}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || `Preview failed (${res.status})`)
      }
      const buf = await res.arrayBuffer()
      pdfArrayBufferRef.current = buf
      await renderPdfToCanvas(buf, 1)
    } catch (e: any) {
      setPreviewError(e?.message || "Failed to load preview")
      setPreviewLoading(false)
    }
  }

  // Re-render on zoom change
  useEffect(() => {
    if (!previewOpen) return
    const buf = pdfArrayBufferRef.current
    if (!buf) return
    renderPdfToCanvas(buf, zoom)
  }, [previewOpen, zoom, renderPdfToCanvas])

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewItem(null)
    setPreviewError(null)
    setZoom(1)
    pdfArrayBufferRef.current = null
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div className="relative w-[min(92vw,900px)] max-h-[86vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="font-semibold">ADR Checklists History</div>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(86vh-64px)]">
          {!role ? (
            <div className="max-w-sm mx-auto">
              <div className="text-center mb-6">
                <div className="text-lg font-semibold">Login</div>
                <div className="text-sm text-gray-600">Admin can delete history items.</div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>User</Label>
                  <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Enter user" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Enter password"
                    type="password"
                  />
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <Button className="w-full" onClick={doLogin}>
                  Log in
                </Button>

                <Button variant="outline" className="w-full bg-transparent" onClick={seeAsGuest}>
                  See as guest
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-600">
                  Viewing as <span className="font-semibold">{role}</span>
                </div>
                <Button variant="outline" className="bg-transparent" onClick={() => setRefreshTick((x) => x + 1)}>
                  Refresh
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <Label>Search</Label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by driver, truck or trailer"
                  />
                </div>
                <Button
                  variant="outline"
                  className="bg-transparent self-start sm:self-end"
                  onClick={() => setSearch("")}
                  disabled={!search.trim()}
                >
                  Clear
                </Button>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="font-semibold mb-3">Reduced ADR Checklist</div>
                {loading && items.length === 0 ? (
                  <div className="text-sm text-gray-600">Loading...</div>
                ) : reduced.length === 0 ? (
                  <div className="text-sm text-gray-600">No items</div>
                ) : (
                  <div className="space-y-2">
                    {reduced.map((it) => (
                      <div
                        key={it.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-words">{itemLabel(it)}</div>
                          <div className="text-xs text-gray-600 break-words">
                            {new Date(it.created_at).toLocaleString()} • expires{" "}
                            {new Date(it.expires_at).toLocaleDateString()}
                            {it.email_sent ? " • emailed" : ""}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => openPreview(it)}
                            disabled={loading}
                          >
                            Preview
                          </Button>

                          <Button
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => onDownloadZip(it)}
                            disabled={!it.downloadUrl}
                          >
                            Download ZIP
                          </Button>

                          {role === "admin" && (
                            <Button variant="outline" className="bg-transparent" onClick={() => onDelete(it)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="font-semibold mb-3">Full ADR Checklist</div>
                {loading && items.length === 0 ? (
                  <div className="text-sm text-gray-600">Loading...</div>
                ) : full.length === 0 ? (
                  <div className="text-sm text-gray-600">No items</div>
                ) : (
                  <div className="space-y-2">
                    {full.map((it) => (
                      <div
                        key={it.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-words">{itemLabel(it)}</div>
                          <div className="text-xs text-gray-600 break-words">
                            {new Date(it.created_at).toLocaleString()} • expires{" "}
                            {new Date(it.expires_at).toLocaleDateString()}
                            {it.email_sent ? " • emailed" : ""}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => openPreview(it)}
                            disabled={loading}
                          >
                            Preview
                          </Button>

                          <Button
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => onDownloadZip(it)}
                            disabled={!it.downloadUrl}
                          >
                            Download ZIP
                          </Button>

                          {role === "admin" && (
                            <Button variant="outline" className="bg-transparent" onClick={() => onDelete(it)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview modal */}
              {previewOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/50" onClick={closePreview} />
                  <div className="relative w-[min(96vw,980px)] max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">Preview</div>
                        {previewItem && (
                          <div className="text-xs text-gray-600 truncate">{itemLabel(previewItem)}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={closePreview}
                        className="rounded-full px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                        aria-label="Close preview"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="px-5 py-3 flex items-center justify-between gap-2 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="bg-transparent"
                          onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                          disabled={previewLoading}
                        >
                          −
                        </Button>
                        <div className="text-sm text-gray-600 w-16 text-center">{Math.round(zoom * 100)}%</div>
                        <Button
                          variant="outline"
                          className="bg-transparent"
                          onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
                          disabled={previewLoading}
                        >
                          +
                        </Button>
                      </div>
                      <div className="text-xs text-gray-600">{previewLoading ? "Rendering…" : ""}</div>
                    </div>

                    <div className="p-4 overflow-auto max-h-[calc(92vh-140px)] bg-gray-50">
                      {previewError ? (
                        <div className="text-sm text-red-600">{previewError}</div>
                      ) : (
                        <div className="flex justify-center">
                          <canvas ref={canvasRef} className="bg-white shadow rounded-xl" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
