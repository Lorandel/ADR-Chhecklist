"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabaseBrowser, normalizeLoginToEmail } from "@/lib/supabaseBrowser"

type AuthContextValue = {
  session: Session | null
  user: User | null
  role: "admin" | "user" | null
  inspectorName: string
  inspectorColor: string
  inspectorEmail: string
  signIn: (usernameOrEmail: string, password: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function pickMetaString(user: User | null, key: string): string {
  const v = (user?.user_metadata as any)?.[key]
  return typeof v === "string" ? v : ""
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowser(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const role: AuthContextValue["role"] = useMemo(() => {
    const r = (user?.user_metadata as any)?.role
    if (r === "admin") return "admin"
    if (r === "user") return "user"
    return user ? "user" : null
  }, [user])

  const inspectorName = useMemo(() => pickMetaString(user, "inspectorName"), [user])
  const inspectorColor = useMemo(() => pickMetaString(user, "inspectorColor"), [user])
  const inspectorEmail = useMemo(() => pickMetaString(user, "inspectorEmail"), [user])

  const signIn: AuthContextValue["signIn"] = async (usernameOrEmail, password) => {
    const email = normalizeLoginToEmail(usernameOrEmail)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, message: error.message }
    return { ok: true }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshUser = async () => {
    const { data } = await supabase.auth.getUser()
    setUser(data.user ?? null)
  }

  const value: AuthContextValue = {
    session,
    user,
    role,
    inspectorName,
    inspectorColor,
    inspectorEmail,
    signIn,
    signOut,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
