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
      {
        url: "/adr-icon.jpg",
        sizes: "32x32",
        type: "image/jpeg",
      },
      {
        url: "/adr-icon.jpg",
        sizes: "16x16",
        type: "image/jpeg",
      },
    ],
    apple: [
      {
        url: "/adr-icon.jpg",
        sizes: "180x180",
        type: "image/jpeg",
      },
    ],
    shortcut: "/adr-icon.jpg",
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
        <link rel="icon" type="image/jpeg" sizes="32x32" href="/adr-icon.jpg" />
        <link rel="icon" type="image/jpeg" sizes="16x16" href="/adr-icon.jpg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/adr-icon.jpg" />
        <link rel="shortcut icon" href="/adr-icon.jpg" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ADR Checklist" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
