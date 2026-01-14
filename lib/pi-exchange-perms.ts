import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

// Shared permission helpers for Buy/Sell Pi feature.
// - Root admin: pi_users.pi_username === 'hlong295' OR pi_users.user_role === 'root_admin'
// - Admin/editor: root admin OR user_role in ('admin','root_admin') OR id is in app_settings.pi_exchange_editor_ids

export async function isUserRootAdmin(
  req: Request,
  admin: any
): Promise<boolean> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return false;

  // Check pi_users record (preferred for Pi logins)
  try {
    const { data: piRow } = await admin
      .from("pi_users")
      .select("pi_username,user_role")
      .eq("id", userId)
      .maybeSingle();
    const piUsername = (piRow as any)?.pi_username;
    const userRole = (piRow as any)?.user_role;
    if (piUsername === "hlong295") return true;
    if (userRole === "root_admin") return true;
  } catch {
    // ignore
  }

  return false;
}

export async function isUserAdminOrEditor(
  req: Request,
  admin: any
): Promise<boolean> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return false;

  if (await isUserRootAdmin(req, admin)) return true;

  // Admin role (pi_users)
  try {
    const { data: piRow } = await admin
      .from("pi_users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();
    const role = (piRow as any)?.user_role;
    if (role === "admin" || role === "root_admin") return true;
  } catch {
    // ignore
  }

  // Editor list from app_settings
  try {
    const { data: settingsRow } = await admin
      .from("app_settings")
      .select("pi_exchange_editor_ids")
      .maybeSingle();
    const ids = (settingsRow as any)?.pi_exchange_editor_ids;
    const arr: string[] = Array.isArray(ids)
      ? ids
      : typeof ids === "string"
      ? ids
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    return arr.includes(userId);
  } catch {
    return false;
  }
}
