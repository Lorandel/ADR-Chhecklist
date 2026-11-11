import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ADR Checklist",
  description: "ADR Equipment Checklist for Transport Safety",
  icons: {
    icon: [
      { url: "/adr-checklist-32.png", sizes: "32x32", type: "image/png" },
      { url: "/adr-checklist-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/adr-checklist-180.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/adr-checklist-32.png",
  },
  manifest: "/manifest.json",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ADR Checklist" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
