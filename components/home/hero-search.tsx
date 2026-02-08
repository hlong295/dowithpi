"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const canGo = useMemo(() => value.trim().length > 0, [value]);

  function go() {
    const q = value.trim();
    if (!q) return;
    router.push(`/chan-doan?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go();
            }
          }}
          placeholder="Vườn bạn đang gặp vấn đề gì?"
          className="flex-1 bg-transparent px-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none"
          aria-label="Tìm vấn đề vườn"
        />
        <button
          type="button"
          onClick={go}
          disabled={!canGo}
          className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          CHẨN ĐOÁN NGAY
        </button>
      </div>
    </div>
  );
}
