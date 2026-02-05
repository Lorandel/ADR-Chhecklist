"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User, SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseBrowser, hasSupabaseBrowserEnv, normalizeLoginToEmail } from "@/lib/supabaseBrowser"

type AuthContextValue = {
  configured: boolean
  configError: string | null
  // True once we have checked Supabase for an existing session (prevents UI flicker on refresh)
  authReady: boolean
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
  const configured = useMemo(() => hasSupabaseBrowserEnv(), [])
  const [configError, setConfigError] = useState<string | null>(null)

  // IMPORTANT: getSupabaseBrowser() can return null if env vars are missing.
  const supabase = useMemo(() => getSupabaseBrowser(), []) as SupabaseClient | null

  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!configured || !supabase) {
      setConfigError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
      )
      // Even if not configured, we are "ready" from the UI perspective.
      setAuthReady(true)
      return
    }

    let mounted = true

    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
      } finally {
        if (mounted) setAuthReady(true)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setAuthReady(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [configured, supabase])

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
    if (!configured || !supabase) return { ok: false, message: configError || "Supabase not configured" }
    const email = normalizeLoginToEmail(usernameOrEmail)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, message: error.message }
    return { ok: true }
  }

  const signOut = async () => {
    if (!configured || !supabase) return
    try {
      await supabase.auth.signOut()
    } finally {
      // Some mobile browsers can be flaky about firing the auth state change event immediately.
      // Force local state reset so the UI reliably returns to the login screen.
      setSession(null)
      setUser(null)
    }
  }

  const refreshUser = async () => {
    if (!configured || !supabase) return
    const { data } = await supabase.auth.getUser()
    setUser(data.user ?? null)
  }

  const value: AuthContextValue = {
    configured,
    configError,
    authReady,
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
