import { Suspense } from "react";
import ProfileClient from "./profile-client";

// Profile depends on client-side session + optional query params (admin view other user).
// Force dynamic to avoid static prerender and wrap useSearchParams() in Suspense.
export const dynamic = "force-dynamic";

function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <div className="text-sm text-gray-600">Đang tải trang tài khoản...</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProfileClient />
    </Suspense>
  );
}
