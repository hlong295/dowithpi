import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserFromRequest, isRootAdmin } from "@/lib/lottery/auth";

/**
 * Settings: profile read/update.
 * - Uses server-side auth (Pi/email). Do NOT trust requesterId from client.
 * - Root admin can read/update another user via query/body userId.
 */

type UpdateBody = {
  userId?: string
  full_name?: string
  phone?: string
  phone_number?: string
  address?: string
}

function pickString(v: any): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

function pickOptString(v: any): string | undefined {
  if (v === null || v === undefined) return undefined
  return String(v)
}

export async function GET(request: Request) {
  try {
    const { userId: requesterId, username } = await getUserFromRequest(request)
    const requesterIsRoot = isRootAdmin({ username })

    const url = new URL(request.url)
    const paramUserId = pickOptString(url.searchParams.get("userId"))

    const targetUserId = paramUserId && requesterIsRoot ? paramUserId : requesterId

    const admin = getSupabaseAdminClient()

    // Try new master table first
    const { data: u1 } = await admin.from("users").select("*").eq("id", targetUserId).maybeSingle()

    // Fallback: legacy table
    const { data: u2 } = await admin.from("pi_users").select("*").eq("id", targetUserId).maybeSingle()

    const row: any = u1 || u2
    if (!row) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: row.id,
        pi_username: row.pi_username,
        full_name: row.full_name ?? "",
        address: row.address ?? "",
        phone: row.phone ?? row.phone_number ?? "",
        avatar_url: row.avatar_url ?? "",
        user_type: row.user_type ?? "",
        user_role: row.user_role ?? "",
        verification_status: row.verification_status ?? "",
        totp_enabled: !!row.totp_enabled,
        email_verified: row.email_verified,
      },
      source: u1 ? "users" : "pi_users",
      debug: { targetUserId, requesterIsRoot },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId: requesterId, username } = await getUserFromRequest(request)
    const requesterIsRoot = isRootAdmin({ username })

    const body = (await request.json()) as UpdateBody

    const targetUserId = body.userId && requesterIsRoot ? pickString(body.userId) : requesterId

    const patchUsers: any = {}
    const patchPiUsers: any = {}

    if (body.full_name !== undefined) {
      patchUsers.full_name = body.full_name
      patchPiUsers.full_name = body.full_name
    }
    if (body.address !== undefined) {
      patchUsers.address = body.address
      patchPiUsers.address = body.address
    }
    // users table uses 'phone'. legacy uses 'phone_number'.
    const phone = body.phone !== undefined ? body.phone : body.phone_number
    if (phone !== undefined) {
      patchUsers.phone = phone
      patchPiUsers.phone_number = phone
    }

    const admin = getSupabaseAdminClient()

    const safeUpdate = async (table: "users" | "pi_users", patch: any) => {
      let cur = { ...patch }
      for (let i = 0; i < 3; i++) {
        const { data, error } = await admin.from(table).update(cur).eq("id", targetUserId).select().maybeSingle()
        if (!error) return { data, error: null as any }

        const msg = String((error as any).message || "")
        const m = msg.match(/column\s+\"([^\"]+)\"\s+does not exist/i)
        if (m && m[1] && cur[m[1]] !== undefined) {
          delete cur[m[1]]
          continue
        }
        const m2 = msg.match(/find the\s+\"([^\"]+)\"\s+column/i)
        if (m2 && m2[1] && cur[m2[1]] !== undefined) {
          delete cur[m2[1]]
          continue
        }
        return { data: null as any, error }
      }
      return { data: null as any, error: null as any }
    }

    let updated: any = null
    let source = ""

    if (Object.keys(patchUsers).length > 0) {
      const { data, error } = await safeUpdate("users", patchUsers)
      if (!error && data) {
        updated = data
        source = "users"
      }
    }

    if (!updated && Object.keys(patchPiUsers).length > 0) {
      const { data, error } = await safeUpdate("pi_users", patchPiUsers)
      if (error) {
        return NextResponse.json({ ok: false, error: (error as any).message, code: (error as any).code }, { status: 400 })
      }
      if (data) {
        updated = data
        source = "pi_users"
      }
    }

    // Best-effort sync to keep the two tables consistent.
    if (updated && source === "users" && Object.keys(patchPiUsers).length > 0) {
      await admin.from("pi_users").update(patchPiUsers).eq("id", targetUserId)
    }
    if (updated && source === "pi_users" && Object.keys(patchUsers).length > 0) {
      await admin.from("users").update(patchUsers).eq("id", targetUserId)
    }

    if (!updated) {
      return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400 })
    }

    return NextResponse.json({ ok: true, source, debug: { targetUserId, requesterIsRoot } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}
