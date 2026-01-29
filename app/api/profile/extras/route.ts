import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest, isRootAdmin } from "@/lib/lottery/auth";

type ExtrasPatch = {
  userId?: string
  intro?: string
  activity_area?: string
  service_field?: string
  provider_contact?: string
  provider_hours?: string
  provider_address?: string
  // provider fields live in pi_users
  provider_business_name?: string
  provider_business_description?: string
}

const norm = (v: any) => {
  if (v === undefined) return undefined
  if (v === null) return null
  const s = String(v)
  return s
}

export async function GET(request: NextRequest) {
  try {
    const { userId: requesterId, username } = await getUserFromRequest(request)
    const requesterIsRoot = isRootAdmin({ username })

    const url = new URL(request.url)
    const paramUserId = url.searchParams.get("userId")
    const targetUserId = paramUserId && requesterIsRoot ? paramUserId : requesterId

    const admin = getSupabaseAdminClient()

    // Ensure row exists (idempotent)
    await admin.from("profile_extras").upsert({ user_id: targetUserId }, { onConflict: "user_id" })

    const { data, error } = await admin
      .from("profile_extras")
      .select("user_id,intro,activity_area,service_field,provider_contact,provider_hours,provider_address")
      .eq("user_id", targetUserId)
      .maybeSingle()

    if (error) throw error

    // Provider business fields from pi_users (source of truth)
    const { data: pi, error: piErr } = await admin
      .from("pi_users")
      .select("provider_business_name,provider_business_description")
      .eq("id", targetUserId)
      .maybeSingle()

    if (piErr) throw piErr

    return NextResponse.json({
      ok: true,
      extras: data || {
        user_id: targetUserId,
        intro: null,
        activity_area: null,
        service_field: null,
        provider_contact: null,
        provider_hours: null,
        provider_address: null,
      },
      provider: pi || {
        provider_business_name: null,
        provider_business_description: null,
      },
      debug: { targetUserId, requesterIsRoot },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId: requesterId, username } = await getUserFromRequest(request)
    const requesterIsRoot = isRootAdmin({ username })

    const body = (await request.json()) as ExtrasPatch

    const targetUserId = body.userId && requesterIsRoot ? body.userId : requesterId

    const admin = getSupabaseAdminClient()

    const extrasPatch: any = {}
    ;(["intro", "activity_area", "service_field", "provider_contact", "provider_hours", "provider_address"] as const).forEach(
      (k) => {
        if ((body as any)[k] !== undefined) extrasPatch[k] = norm((body as any)[k])
      }
    )

    // Upsert extras
    if (Object.keys(extrasPatch).length > 0) {
      const { error } = await admin
        .from("profile_extras")
        .upsert({ user_id: targetUserId, ...extrasPatch }, { onConflict: "user_id" })

      if (error) throw error
    }

    const piPatch: any = {}
    if (body.provider_business_name !== undefined) piPatch.provider_business_name = norm(body.provider_business_name)
    if (body.provider_business_description !== undefined)
      piPatch.provider_business_description = norm(body.provider_business_description)

    if (Object.keys(piPatch).length > 0) {
      const { error } = await admin.from("pi_users").update(piPatch).eq("id", targetUserId)
      if (error) throw error
    }

    return NextResponse.json({ ok: true, debug: { targetUserId, requesterIsRoot } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}
