import { type NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest) {
  // Keep this endpoint SAFE during build/export: no external calls, no side effects.
  const envCheck = {
    GMAIL_USER: !!process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  const envValues = {
    GMAIL_USER: process.env.GMAIL_USER ? "SET" : "NOT_SET",
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? "SET" : "NOT_SET",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT_SET",
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT_SET",
    SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT_SET",
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    environmentVariables: envCheck,
    environmentValues: envValues,
    note: "Drive tests disabled. This endpoint performs only safe checks.",
  })
}
