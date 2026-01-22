"use client"

import { useState } from "react"
import ADRChecklist, { type ChecklistVariant } from "@/components/AdrChecklist"

export default function HomePage() {
  const [variant, setVariant] = useState<ChecklistVariant | null>(null)

  if (variant) {
    return <ADRChecklist variant={variant} onBack={() => setVariant(null)} />
  }
  return (
    <div className="min-h-[100vh] flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-3xl relative">
        {/* Watermark (center) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <img src="/images/albias-watermark.png" alt="Albias Watermark" className="w-64 md:w-96 opacity-15" />
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-center mb-8">ADR Checklist</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              type="button"
              className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black min-h-[120px] flex items-center justify-center text-center"
              onClick={() => setVariant("under1000")}
            >
              <div className="text-xl font-semibold">Reduced Checklist (Under 1000)</div>
            </button>

            <button
              type="button"
              className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black min-h-[120px] flex items-center justify-center text-center"
              onClick={() => setVariant("full")}
            >
              <div className="text-xl font-semibold">Full Checklist (1000+)</div>
            </button>
          </div>

          <p className="text-sm text-gray-600 text-center mt-6">
            Choose the correct option based on the ADR points planned for loading.
          </p>
        </div>
      </div>
    </div>
  )
}
