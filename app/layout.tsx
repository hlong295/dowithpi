import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Geist_Mono } from "next/font/google"
import PiSdkLoader from "@/components/pi-sdk-loader"
import DebugPerfOverlay from "@/components/debug-perf-overlay"
import "./globals.css"
import { LanguageProvider } from "@/lib/language-context"
import { AuthProvider } from "@/lib/auth-context"
import { PiAuthProvider } from "@/lib/pi-auth-context"
import PiDebugOverlay from "@/components/pi-debug-overlay"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "PITODO - Nền tảng trao đổi Pi",
  description: "PITODO - Nền tảng trao đổi Pi minh bạch và an toàn",
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#9333ea",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <head />
      <body className="font-sans bg-background">
        {/* PERF: Pi Browser already injects the Pi SDK. Re-downloading it can add
            a slow third‑party request on every first load. We only load the SDK
            if window.Pi is not present. */}
        <PiSdkLoader />
        <LanguageProvider>
          <AuthProvider>
            <PiAuthProvider>
              {children}
              <PiDebugOverlay />
              <DebugPerfOverlay />
            </PiAuthProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
