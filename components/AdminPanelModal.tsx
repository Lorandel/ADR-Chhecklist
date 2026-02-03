"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/AuthProvider"

type Props = { open: boolean; onClose: () => void }

type AdminUser = {
  id: string
  email: string
  created_at?: string
  user_metadata?: Record<string, any>
}

function usernameFromEmail(email: string): string {
  const e = (email || "").toLowerCase()
  if (e.endsWith("@adr.local")) return e.slice(0, -"@adr.local".length)
  return email
}

export default function AdminPanelModal({ open, onClose }: Props) {
  const { session, role, refreshUser } = useAuth()
  const token = session?.access_token || ""

  // In-app terminal for system checks
  const [terminal, setTerminal] = useState<string>("")
  const [running, setRunning] = useState(false)
  const [abortCtl, setAbortCtl] = useState<AbortController | null>(null)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // create user form
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "user">("user")
  const [newInspectorName, setNewInspectorName] = useState("")
  const [newInspectorColor, setNewInspectorColor] = useState("")
  const [newInspectorEmail, setNewInspectorEmail] = useState("")

  // tests (Drive tests removed per request)
  const testEndpoints = useMemo(
    () => [
      { label: "Check Email Config", path: "/api/test-email" },
      { label: "Send Test Email", path: "/api/test-email?send=1" },
      { label: "Check Blob Config", path: "/api/test-blob" },
      { label: "Blob Write Test", path: "/api/test-blob?run=1" },
      { label: "Debug Env", path: "/api/debug" },
    ],
    [],
  )

  useEffect(() => {
    if (!open) {
      setError(null)
      setInfo(null)
      return
    }
    if (role !== "admin") return
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role])

  const loadUsers = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `Failed (${res.status})`)
      setUsers(Array.isArray(data.users) ? data.users : [])
    } catch (e: any) {
      setError(e?.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const createUser = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create",
          username: newUsername,
          password: newPassword,
          role: newRole,
          inspectorName: newInspectorName,
          inspectorColor: newInspectorColor,
          inspectorEmail: newInspectorEmail,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `Failed (${res.status})`)
      setInfo("User created")
      setNewUsername("")
      setNewPassword("")
      setNewInspectorName("")
      setNewInspectorColor("")
      setNewInspectorEmail("")
      await loadUsers()
      await refreshUser()
    } catch (e: any) {
      setError(e?.message || "Create failed")
    } finally {
      setLoading(false)
    }
  }

  const updateUser = async (u: AdminUser, patch: any) => {
    if (!token) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "update", userId: u.id, ...patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `Failed (${res.status})`)
      setInfo("Updated")
      await loadUsers()
      await refreshUser()
    } catch (e: any) {
      setError(e?.message || "Update failed")
    } finally {
      setLoading(false)
    }
  }

  const runTest = async (path: string) => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(path, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`)
      if (data?.success === false) {
        setError(`${path}: ${data?.error || data?.message || "Not configured"}`)
      } else {
        setInfo(`${path}: OK`)
      }
    } catch (e: any) {
      setError(`${path}: ${e?.message || "Failed"}`)
    } finally {
      setLoading(false)
    }
  }

  const runAll = async () => {
    for (const t of testEndpoints) {
      // eslint-disable-next-line no-await-in-loop
      await runTest(t.path)
    }
  }

  const stopSystemCheck = () => {
    try {
      abortCtl?.abort()
    } catch {}
    setAbortCtl(null)
    setRunning(false)
  }

  const runSystemCheck = async (sendEmail: boolean) => {
    if (!token) {
      setError("Missing session token")
      return
    }
    stopSystemCheck()
    setTerminal("")
    setError(null)
    setInfo(null)
    const ctl = new AbortController()
    setAbortCtl(ctl)
    setRunning(true)

    try {
      const url = `/api/system-test${sendEmail ? "?send=1" : ""}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: ctl.signal,
      })
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setTerminal((prev) => prev + chunk)
      }
      setInfo("System check finished")
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setInfo("System check stopped")
      } else {
        setError(e?.message || "System check failed")
      }
    } finally {
      setRunning(false)
      setAbortCtl(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="text-lg font-bold">Admin Panel</div>
          <Button variant="outline" onClick={onClose} className="bg-transparent">
            Close
          </Button>
        </div>

        {role !== "admin" ? (
          <div className="p-6">
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Unauthorized</div>
          </div>
        ) : (
          <div className="p-6 space-y-8 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="font-semibold mb-3">Create user</div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>User</Label>
                    <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. lucian" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={newRole === "user"} onChange={() => setNewRole("user")} /> user
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={newRole === "admin"} onChange={() => setNewRole("admin")} /> admin
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label>Inspector name</Label>
                    <Input value={newInspectorName} onChange={(e) => setNewInspectorName(e.target.value)} placeholder="Displayed name" />
                  </div>
                  <div>
                    <Label>Inspector color (HEX)</Label>
                    <Input value={newInspectorColor} onChange={(e) => setNewInspectorColor(e.target.value)} placeholder="#111827" />
                  </div>
                  <div>
                    <Label>Inspector email (ZIP recipient)</Label>
                    <Input value={newInspectorEmail} onChange={(e) => setNewInspectorEmail(e.target.value)} placeholder="name@company.com" />
                  </div>

                  <Button onClick={createUser} disabled={loading || !newUsername || !newPassword}>
                    Create
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="font-semibold mb-3">System tests</div>
                <div className="flex flex-wrap gap-2">
                  {testEndpoints.map((t) => (
                    <Button key={t.path} variant="outline" className="bg-transparent" onClick={() => void runTest(t.path)} disabled={loading}>
                      {t.label}
                    </Button>
                  ))}
                  <Button onClick={() => void runAll()} disabled={loading}>
                    Run all
                  </Button>
                </div>

                <div className="mt-4">
                  <div className="font-semibold mb-2">Admin system check (terminal)</div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void runSystemCheck(false)} disabled={running || !token}>
                      Run system check
                    </Button>
                    <Button variant="outline" className="bg-transparent" onClick={() => void runSystemCheck(true)} disabled={running || !token}>
                      Run & send test email
                    </Button>
                    <Button variant="outline" className="bg-transparent" onClick={stopSystemCheck} disabled={!running}>
                      Stop
                    </Button>
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {terminal || "(output will appear here)"}
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  These endpoints are safe during build. Actions that create external side effects run only when you click a "Run" button (query params).
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Users</div>
                <Button variant="outline" className="bg-transparent" onClick={() => void loadUsers()} disabled={loading}>
                  Refresh
                </Button>
              </div>

              {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {info && <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{info}</div>}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Inspector</th>
                      <th className="py-2 pr-3">Color</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const meta = u.user_metadata || {}
                      return (
                        <tr key={u.id} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-3 font-mono">{usernameFromEmail(u.email)}</td>
                          <td className="py-2 pr-3">{meta.role || "user"}</td>
                          <td className="py-2 pr-3">{meta.inspectorName || ""}</td>
                          <td className="py-2 pr-3">{meta.inspectorColor || ""}</td>
                          <td className="py-2 pr-3">{meta.inspectorEmail || ""}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                className="bg-transparent"
                                onClick={() => void updateUser(u, { role: meta.role === "admin" ? "user" : "admin" })}
                                disabled={loading}
                              >
                                Toggle role
                              </Button>
                              <Button
                                variant="outline"
                                className="bg-transparent"
                                onClick={() => {
                                  const name = prompt("Inspector name", meta.inspectorName || "") ?? ""
                                  const color = prompt("Inspector color (HEX)", meta.inspectorColor || "") ?? ""
                                  const email = prompt("Inspector email", meta.inspectorEmail || "") ?? ""
                                  void updateUser(u, { inspectorName: name, inspectorColor: color, inspectorEmail: email })
                                }}
                                disabled={loading}
                              >
                                Edit inspector
                              </Button>
                              <Button
                                variant="outline"
                                className="bg-transparent"
                                onClick={() => {
                                  const pw = prompt("New password (leave empty to cancel)")
                                  if (!pw) return
                                  void updateUser(u, { newPassword: pw })
                                }}
                                disabled={loading}
                              >
                                Set password
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {!loading && users.length === 0 && <div className="text-sm text-gray-500 mt-3">No users</div>}
                {loading && <div className="text-sm text-gray-500 mt-3">Loading...</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
