"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { isRootIdentity } from "@/lib/root-admin";

type AdminRole = "root_admin" | "editor" | "provider" | "approval";

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, emailUser } = useAuth();

  const role = (emailUser?.role as AdminRole | null) || null;

  const isRootAdmin = useMemo(
    () =>
      isRootIdentity({
        email: emailUser?.email,
        username: emailUser?.username,
        role: emailUser?.role,
      }),
    [emailUser?.email, emailUser?.username, emailUser?.role]
  );

  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Hard guard: non-auth -> login.
    if (!isAuthenticated) {
      router.replace("/tai-khoan");
      return;
    }

    // IMPORTANT: Do not redirect away while the emailUser role is still being hydrated.
    // Root can be determined by stable identity (email/username) even before `/api/auth/me` completes.
    const isAdmin =
      isRootAdmin ||
      role === "root_admin" ||
      role === "editor" ||
      role === "provider" ||
      role === "approval";

    if (!isAdmin) {
      // Do not kick the user back to home; show a clear message in-place.
      setErr("FORBIDDEN_NOT_ADMIN");
    } else {
      setErr(null);
    }
  }, [isAuthenticated, role, isRootAdmin, router]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        setToken(data?.session?.access_token || null);
      } catch (e: any) {
        setErr(e?.message || "NO_SESSION");
      }
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/admin">Dashboard</Link></Button>

            {/* Business */}
            <Button asChild variant="outline"><Link href="/admin/products">Products</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/categories">Categories</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/providers">Providers</Link></Button>
            {/* CMS */}
            <Button asChild variant="outline"><Link href="/admin/content/news">Tin tức CMS</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/content/rescue">Cứu vườn CMS</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/media">Media</Link></Button>

            {/* Root-only tools */}
            {isRootAdmin ? (
              <>
                <Button asChild variant="outline"><Link href="/admin/users">Users</Link></Button>
                <Button asChild variant="outline"><Link href="/admin/identities">Identities</Link></Button>
                <Button asChild variant="outline"><Link href="/admin/wallets">Wallets</Link></Button>
                <Button asChild variant="outline"><Link href="/admin/ledger">Ledger</Link></Button>
                <Button asChild variant="outline"><Link href="/admin/audit">Audit</Link></Button>
                <Button asChild variant="outline"><Link href="/admin/rules">Rules</Link></Button>
                <Button asChild variant="outline"><Link href="/admin/orphans">Orphans</Link></Button>
              </>
            ) : null}
          </div>
          <Separator className="my-4" />

          {err === "FORBIDDEN_NOT_ADMIN" ? (
            <div className="text-sm text-red-600">
              Bạn không có quyền truy cập Admin. (FORBIDDEN_NOT_ADMIN)
            </div>
          ) : err ? (
            <div className="text-sm text-red-600">Admin session error: {err}</div>
          ) : !token ? (
            <div className="text-sm text-muted-foreground">Bạn cần đăng nhập email để dùng Admin.</div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export async function getAdminBearer() {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
