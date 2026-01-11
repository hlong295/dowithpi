"use client"
import type React from "react"
import { useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { AccountHubWrapper } from "@/components/account-hub-wrapper"

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const [accountHubOpen, setAccountHubOpen] = useState(false)

  return (
    <>
      <Header onOpenAccountHub={() => setAccountHubOpen(true)} />

      <main className="min-h-screen pb-20">{children}</main>

      <BottomNav />

      <AccountHubWrapper isOpen={accountHubOpen} onClose={() => setAccountHubOpen(false)} />
    </>
  )
}
