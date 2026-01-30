"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/AuthProvider"

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { session, signIn } = useAuth()
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
    <div className="min-h-[100vh] flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-6">Connect</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">User</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connecting..." : "Login"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Tip: you can login with a simple username (e.g. <span className="font-mono">admin</span>) if the account was created with
          the internal format.
        </p>
      </div>
    </div>
  )
}
