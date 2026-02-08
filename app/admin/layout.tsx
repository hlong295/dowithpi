import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <AppHeader />

      {/*
        AppHeader is fixed (h-14). Keep content clear of header & bottom nav.
        Match spacing used across the app pages.
      */}
      <div className="pt-[calc(3.5rem+1.25rem)] pb-24">{children}</div>

      <AppFooter />
    </div>
  );
}
