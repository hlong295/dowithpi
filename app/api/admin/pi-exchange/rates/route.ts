import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

async function ensureAppSettingsRow(supabase: any) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error && data) return data;

  const { data: inserted, error: insErr } = await supabase
    .from("app_settings")
    .insert({
      service_fee_percentage: 2,
      tax_percentage: 8,
    })
    .select("*")
    .single();

  if (insErr) throw new Error((insErr as any)?.message || "INSERT_APP_SETTINGS_FAILED");
  return inserted;
}

async function getUpdaterLabel(supabase: any, userId: string): Promise<string> {
  // Prefer Pi username; fallback to users.email; final fallback: short id.
  try {
    const { data: piUser } = await supabase
      .from("pi_users")
      .select("pi_username")
      .eq("id", userId)
      .maybeSingle();

    const piUsername = (piUser as any)?.pi_username as string | undefined;
    if (piUsername && piUsername.trim()) return piUsername.trim();
  } catch {}

  try {
    const { data: u } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const email = (u as any)?.email as string | undefined;
    if (email && email.trim()) {
      const e = email.trim();
      const at = e.indexOf("@");
      // Show the local-part when possible ("mrjqka" instead of "mrjqka@example.com").
      return at > 0 ? e.slice(0, at) : e;
    }
  } catch {}

  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

function toNumberOrNull(v: any) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

function parseEditors(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  return [];
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdminClient();

    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Bạn chưa đăng nhập." }, { status: 401 });
    }

    const settings = await ensureAppSettingsRow(supabase);

    // Permission: admin OR editor allowlist
    let allowed = false;
    try {
      await requireAdmin(requesterId);
      allowed = true;
    } catch {
      // not admin
    }

    const editorIds = parseEditors((settings as any)?.pi_exchange_editor_ids);
    if (editorIds.includes(requesterId)) allowed = true;

    if (!allowed) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Bạn không có quyền cập nhật giá." }, { status: 403 });
    }

    const updaterLabel = await getUpdaterLabel(supabase, requesterId);

    const body = await req.json().catch(() => null);
    const buy = toNumberOrNull(body?.buy_price_vnd);
    const sell = toNumberOrNull(body?.sell_price_vnd);

    const rowId = (settings as any)?.id;
    if (!rowId) {
      return NextResponse.json({ ok: false, code: "APP_SETTINGS_MISSING_ID", message: "Thiếu id trong app_settings." }, { status: 500 });
    }

    const payload: any = {
      pi_buy_price_vnd: buy,
      pi_sell_price_vnd: sell,
    };

    // Ensure updated_at changes even if app_settings has no trigger
    if ((settings as any)?.hasOwnProperty("updated_at")) {
      payload.updated_at = new Date().toISOString();
    }

    // Optional explicit timestamp (if column exists)
    if ((settings as any)?.hasOwnProperty("pi_exchange_updated_at")) {
      payload.pi_exchange_updated_at = new Date().toISOString();
    }

    // Optional: store who updated (if DB has the column). We try once, and if the column doesn't exist
    // we retry without it to avoid breaking deployments.
    const payloadWithBy: any = {
      ...payload,
      pi_exchange_updated_by: updaterLabel,
    };

    let data: any = null;
    let error: any = null;

    {
      const r = await supabase
        .from("app_settings")
        .update(payloadWithBy)
        .eq("id", rowId)
        .select("*")
        .single();
      data = r.data;
      error = r.error;
    }

    if (error) {
      const msg = String((error as any)?.message || "").toLowerCase();
      if (msg.includes("column") && msg.includes("pi_exchange_updated_by")) {
        const r2 = await supabase
          .from("app_settings")
          .update(payload)
          .eq("id", rowId)
          .select("*")
          .single();
        data = r2.data;
        error = r2.error;
      }
    }

    if (error) {
      const msg = String((error as any)?.message || "");
      if (msg.toLowerCase().includes("column") && msg.toLowerCase().includes("pi_buy_price_vnd")) {
        return NextResponse.json(
          {
            ok: true,
            reason: "COLUMNS_MISSING",
            message: "DB thiếu cột giá Pi. Hãy chạy SQL_BUY_SELL_PI_PRICES.sql",
          },
          { status: 200 }
        );
      }
      return NextResponse.json({ ok: false, code: "UPDATE_FAILED", message: msg }, { status: 500 });
    }

    const updatedAt = (data as any)?.pi_exchange_updated_at || (data as any)?.updated_at || null;

    return NextResponse.json({
      ok: true,
      buy_price_vnd: (data as any)?.pi_buy_price_vnd ?? buy,
      sell_price_vnd: (data as any)?.pi_sell_price_vnd ?? sell,
      updated_at: updatedAt,
      updated_by: (data as any)?.pi_exchange_updated_by || updaterLabel,
      message: "Đã cập nhật giá.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "ERROR", message: String(e?.message || e) }, { status: 500 });
  }
}
