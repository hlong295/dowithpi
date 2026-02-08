import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";

export default async function ChanDoanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const qRaw = sp.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : (qRaw || "");

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <AppHeader />

      <main className="max-w-[1200px] mx-auto px-4 py-6 pb-24">
        <h1 className="text-xl font-bold text-[#1d4d2e]">Chẩn đoán</h1>
        <p className="text-sm text-gray-600 mt-1">Nhập vấn đề vườn bạn đang gặp để nhận đề xuất.</p>

        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700">Vấn đề / triệu chứng</label>
          <input
            defaultValue={q}
            placeholder="Ví dụ: vàng lá, rụng trái, thối rễ..."
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2d6a3f]"
          />
          <button
            type="button"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#2d6a3f] px-4 py-3 text-white font-semibold"
          >
            Chẩn đoán ngay
          </button>

          <p className="mt-3 text-xs text-gray-500">
            (A1.3) Page này hiện là placeholder tối thiểu để nhận query từ Home. Sẽ hoàn thiện theo checklist B1.
          </p>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
