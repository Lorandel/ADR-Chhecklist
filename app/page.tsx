// app/page.tsx
"use client"

import { useState } from "react"
import ADRChecklist, { type ChecklistVariant } from "@/components/AdrChecklist"
import AdrHistoryModal from "@/components/AdrHistoryModal"
import AdminPanelModal from "@/components/AdminPanelModal"
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider"
import LoginGate from "@/components/auth/LoginGate"
import { Button } from "@/components/ui/button"

function HomePageInner() {
  const { role, signOut, inspectorName } = useAuth()
  const [variant, setVariant] = useState<ChecklistVariant | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  if (variant) {
    return <ADRChecklist variant={variant} onBack={() => setVariant(null)} />
  }

  return (
    <div className="min-h-[100vh] flex items-center justify-center p-6 bg-white relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
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

        <Button variant="outline" className="bg-transparent" onClick={() => void signOut()}>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => setVariant("under1000")}
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
            onClick={() => setVariant("full")}
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
