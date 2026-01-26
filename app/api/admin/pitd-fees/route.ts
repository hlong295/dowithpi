import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

export const dynamic = "force-dynamic";

function isRootAdmin(piUsername?: string | null) {
  return (piUsername || "").toLowerCase() === "hlong295";
}

export async function GET(req: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: requesterPi } = await supabase
      .from("pi_users")
      .select("pi_username,user_role")
      .eq("id", requesterId)
      .maybeSingle();

    const isAdmin =
      isRootAdmin(requesterPi?.pi_username) ||
      (requesterPi?.user_role || "").toLowerCase() === "admin";
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { data: settings, error } = await supabase
      .from("app_settings")
      .select("id,pitd_user_post_fee,pitd_provider_post_fee,updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "APP_SETTINGS_LOAD_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: requesterPi } = await supabase
      .from("pi_users")
      .select("pi_username,user_role")
      .eq("id", requesterId)
      .maybeSingle();

    const isAdmin =
      isRootAdmin(requesterPi?.pi_username) ||
      (requesterPi?.user_role || "").toLowerCase() === "admin";
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const pitd_user_post_fee = Number(body?.pitd_user_post_fee);
    const pitd_provider_post_fee = Number(body?.pitd_provider_post_fee);

    if (!Number.isFinite(pitd_user_post_fee) || pitd_user_post_fee < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_USER_POST_FEE" }, { status: 400 });
    }
    if (!Number.isFinite(pitd_provider_post_fee) || pitd_provider_post_fee < 0) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PROVIDER_POST_FEE" },
        { status: 400 }
      );
    }

    const { data: settingsRow, error: rowErr } = await supabase
      .from("app_settings")
      .select("id,updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (rowErr) {
      return NextResponse.json(
        { ok: false, error: "APP_SETTINGS_LOAD_FAILED", detail: rowErr.message },
        { status: 500 }
      );
    }
    if (!settingsRow?.id) {
      return NextResponse.json({ ok: false, error: "APP_SETTINGS_NOT_FOUND" }, { status: 500 });
    }

    const { error: upErr } = await supabase
      .from("app_settings")
      .update({
        pitd_user_post_fee,
        pitd_provider_post_fee,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settingsRow.id);

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: "APP_SETTINGS_UPDATE_FAILED", detail: upErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
