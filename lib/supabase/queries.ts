import { getSupabaseBrowserClient } from "./client"

// ⚠️ IMPORTANT
// This file is CLIENT-SAFE ONLY.
// Do NOT import ./server here under any circumstance.
// All server logic must live in route.ts files.

export async function getUserByPiUid(piUid: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("*")
    .eq("pi_uid", piUid)
    .single()

  if (error && error.code !== "PGRST116") return null
  return data
}

export async function getUserByUsername(username: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("*")
    .eq("pi_username", username)
    .maybeSingle()

  if (error && error.code !== "PGRST116") return null
  return data
}

export async function getPitdWalletBalance(userId: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pitd_wallets")
    .select("balance")
    .eq("user_id", userId)
    .single()

  if (error && error.code !== "PGRST116") return 0
  return data?.balance || 0
}

/* 
⚠️ Các hàm TẠO / UPDATE / ADMIN / TRANSACTION
→ PHẢI CHUYỂN SANG app/api/**/route.ts
→ KHÔNG ĐƯỢC để trong queries.ts
*/
