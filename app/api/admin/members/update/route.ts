export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

// Root admin allowlist (case-insensitive) to avoid lockout in edge cases.
const ROOT_ADMIN_USERNAMES = ["hlong295"]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type BanType = "none" | "temp" | "perm"
type MemberLabel = "regular" | "trusted"
type ProviderLabel = "unverified" | "verified" | "trusted"

function clampInt(n: any, min: number, max: number) {
  const x = Number.parseInt(String(n ?? ""), 10)
  if (Number.isNaN(x)) return min
  return Math.max(min, Math.min(max, x))
}

async function resolveRequesterIdentity(supabase: any, requesterId: string) {
  // requesterId can be UUID or pi_username or email
  const rid = String(requesterId || "").trim()
  if (!rid) return null

  if (UUID_RE.test(rid)) {
    const { data, error } = await supabase
      .from("pi_users")
      .select("id, pi_username, user_role")
      .eq("id", rid)
      .maybeSingle()
    if (error || !data) return null
    return data
  }

  // Try pi_username
  {
    const { data, error } = await supabase
      .from("pi_users")
      .select("id, pi_username, user_role")
      .ilike("pi_username", rid)
      .maybeSingle()
    if (!error && data) return data
  }

  // Try email on users (master)
  {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, user_role")
      .ilike("email", rid)
      .maybeSingle()
    if (!error && data) {
      // Map to pi_users row if exists
      const { data: piRow } = await supabase
        .from("pi_users")
        .select("id, pi_username, user_role")
        .eq("id", data.id)
        .maybeSingle()
      return (
        piRow || {
          id: data.id,
          pi_username: (data as any).email || "",
          user_role: (data as any).user_role || null,
        }
      )
    }
  }

  return null
}

async function assertAdmin(supabase: any, requesterId: string) {
  const r = await resolveRequesterIdentity(supabase, requesterId)
  if (!r) return { ok: false as const, error: "Requester not found" }

  const username = String((r as any).pi_username || "").toLowerCase()
  const isRoot = ROOT_ADMIN_USERNAMES.includes(username)

  // Admin if user_role == 'admin' OR root allowlist
  const role = String((r as any).user_role || "").toLowerCase()
  const isAdmin = isRoot || role === "admin"

  if (!isAdmin) return { ok: false as const, error: "Not authorized" }
  return { ok: true as const, requester: r }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    // Defensive: ids can be accidentally sent as objects from some clients.
    const normalizeId = (v: any): string => {
      if (!v) return ""
      if (typeof v === "string") return v.trim()
      if (typeof v === "number") return String(v)
      if (typeof v === "object") {
        const candidate = (v as any)?.id ?? (v as any)?.userId ?? (v as any)?.uid ?? (v as any)?.value
        return typeof candidate === "string" ? candidate.trim() : candidate ? String(candidate) : ""
      }
      return String(v).trim()
    }

    const requesterId = normalizeId(body?.requesterId)
    const targetUserId = normalizeId(body?.targetUserId)

    // Some UIs send label fields at the top-level (memberLabel/providerLabel)
    // while others send them under `updates`.
    const updates: any =
      body?.updates && typeof body.updates === "object" && !Array.isArray(body.updates)
        ? { ...body.updates }
        : {}

    if (action === "set_member_label" && body?.memberLabel && !updates.memberLabel) {
      updates.memberLabel = body.memberLabel
    }
    if (action === "set_provider_label" && body?.providerLabel && !updates.providerLabel) {
      updates.providerLabel = body.providerLabel
    }

    if (!requesterId || !targetUserId) {
      return NextResponse.json({ error: "Missing requesterId/targetUserId" }, { status: 400 })
    }
    if (!UUID_RE.test(targetUserId)) {
      return NextResponse.json(
        {
          error: "targetUserId must be UUID",
          debug: { targetUserId, targetUserIdType: typeof body?.targetUserId },
        },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const adminCheck = await assertAdmin(supabase, requesterId)
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const patch: any = {}

    // Ban / lock
    if (updates?.banType) {
      const banType = String(updates.banType) as BanType
      if (!["none", "temp", "perm"].includes(banType)) {
        return NextResponse.json({ error: "Invalid banType" }, { status: 400 })
      }

      patch.ban_type = banType
      patch.banned_reason = updates?.bannedReason ? String(updates.bannedReason).slice(0, 300) : null

      if (banType === "none") {
        patch.is_banned = false
        patch.banned_until = null
      } else if (banType === "temp") {
        const days = clampInt(updates?.banDays, 1, 365)
        patch.is_banned = true
        patch.banned_until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      } else if (banType === "perm") {
        patch.is_banned = true
        patch.banned_until = null
      }
    }

    // Member label
    if (updates?.memberLabel) {
      const memberLabel = String(updates.memberLabel) as MemberLabel
      if (!["regular", "trusted"].includes(memberLabel)) {
        return NextResponse.json({ error: "Invalid memberLabel" }, { status: 400 })
      }
      patch.member_label = memberLabel
    }

    // Provider label
    if (updates?.providerLabel) {
      const providerLabel = String(updates.providerLabel) as ProviderLabel
      if (!["unverified", "verified", "trusted"].includes(providerLabel)) {
        return NextResponse.json({ error: "Invalid providerLabel" }, { status: 400 })
      }
      patch.provider_label = providerLabel
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }
    // Update both pi_users and users (master) when columns exist.
    const results: any = { pi_users: null, users: null }

    const { data: piRow, error: piErr } = await supabase
      .from("pi_users")
      .update(patch)
      .eq("id", targetUserId)
      .select("id, is_banned, ban_type, banned_until, banned_reason, member_label, provider_label, provider_approved, user_role")
      .maybeSingle()

    if (piErr) {
      return NextResponse.json({ error: "Update pi_users failed", details: piErr.message }, { status: 500 })
    }
    results.pi_users = piRow

    // Best-effort update users table (ignore if table/columns mismatch)
    try {
      const { data: uRow, error: uErr } = await supabase
        .from("users")
        .update(patch)
        .eq("id", targetUserId)
        .select("id, is_banned, ban_type, banned_until, banned_reason, member_label, provider_label, provider_approved, user_role")
        .maybeSingle()

      if (!uErr) results.users = uRow
    } catch (_) {
      // ignore
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: "Server error", details: String(e?.message || e) }, { status: 500 })
  }
}
