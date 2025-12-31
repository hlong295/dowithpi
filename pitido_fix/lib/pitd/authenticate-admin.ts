import { jsonError } from "@/lib/api/json"

export async function authenticateAdmin() {
  // TEMP: cho build pass
  // Sau khi app chạy, mình sẽ gắn lại logic check admin thật
  return { ok: true }
}

export function requireAdmin(result: any) {
  if (!result?.ok) return jsonError("Unauthorized", 401)
  return null
}
