"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/AuthProvider"

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { session, signIn, configured, configError } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <>{children}</>

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await signIn(username, password)
      if (!res.ok) setError(res.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100vh] flex items-center justify-center bg-white px-4 py-8 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-center mb-4">
          <img
            src="/images/albias-watermark.png"
            alt="Alblas watermark"
            className="w-48 sm:w-56"
          />
        </div>

       

        {!configured && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {configError || "Supabase is not configured."}
            <div className="mt-2 text-xs text-amber-700">
              Add env vars in Vercel/GitHub Actions: <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>.
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">User</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={!configured}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={!configured}
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <Button type="submit" className="w-full" disabled={loading || !configured}>
            {loading ? "Connecting..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  )
}
