"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import type { User, PiUser, EmailUser, UserRole } from "./types"
import { signInWithPi, createPiPayment } from "./pi-sdk"

// Version marker for debugging. (We keep backward compatibility for stored user payloads.)
const AUTH_VERSION = "v6.1-fix-user-type"
const PI_USER_STORAGE_KEY = "pitodo_pi_user"
// ✅ internal UUID (public.pi_users.id) used for PITD wallet + reviews
// NOTE: The codebase historically used two key families:
// - legacy: "pi_user_id", "pi_username"
// - newer:  "pitodo_pi_user_id", "pitodo_pi_username", "pitodo_user_type"
// To avoid breaking any page (Account/Admin/etc.), we write BOTH.
const PI_USER_ID_STORAGE_KEY = "pi_user_id" // legacy
const PITODO_PI_USER_ID_STORAGE_KEY = "pitodo_pi_user_id" // used by Account/Admin pages
const PITODO_PI_USERNAME_STORAGE_KEY = "pitodo_pi_username"
const PITODO_USER_TYPE_STORAGE_KEY = "pitodo_user_type"
const PI_USER_COOKIE_KEY = "pitodo_pi_user"

// Perf: avoid bundling supabase-js + query helpers into the critical client chunk.
// We lazy-load them only when needed (email auth, provider ops, etc.). This improves Pi Browser first paint.
let _supabaseClientPromise: Promise<any> | null = null
async function getSupabaseBrowserClientLazy() {
  if (!_supabaseClientPromise) {
    _supabaseClientPromise = import("./supabase/client").then((m) => m.getSupabaseBrowserClient())
  }
  return _supabaseClientPromise
}

type QueriesModule = typeof import("./supabase/queries")
let _queriesPromise: Promise<QueriesModule> | null = null
async function getQueriesLazy(): Promise<QueriesModule> {
  if (!_queriesPromise) {
    _queriesPromise = import("./supabase/queries")
  }
  return _queriesPromise
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Root admin Pi username used throughout the app (UI gating + server checks).
// Exported so feature modules (e.g. Lucky Spin) can safely import it.
export const ROOT_ADMIN_USERNAME = "HLong295"

type AuthContextType = {
  user: User | null
  isLoading: boolean
  loginWithPi: () => Promise<{ success: boolean; piUserId?: string }>
  loginWithEmail: (emailOrUsername: string, password: string, totpCode?: string) => Promise<void>
  registerWithEmail: (data: {
    username: string
    email: string
    password: string
    fullName: string
    phoneNumber: string
    address: string
  }) => Promise<any>
  verifyEmail: (token: string) => Promise<void>
  setupTwoFactor: () => Promise<{ secret: string; qrCode: string }>
  enableTwoFactor: (totpCode: string) => Promise<void>
  applyAsProvider: (businessName: string, description: string) => Promise<void>
  approveProviderApplication: (providerId: string, action: "approve" | "reject", reason?: string) => Promise<void>
  getPendingProviderApplications: () => Promise<any[]>
  logout: () => void
  isAdmin: () => boolean
  isProvider: () => boolean
  createPiPayment: (amount: number, memo: string, metadata: any) => Promise<any>
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(";").shift()
    return cookieValue || null
  }
  return null
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const piLoginInProgressRef = useRef(false)
  const lastProcessedUserIdRef = useRef<string | null>(null)

  // NOTE: Pi Browser performance can degrade heavily with frequent console logging.
  // Keep logs only in debug mode (/?dbg=1 or localStorage pitodo_dbg=1) or in dev.
  const __dbgEnabled = () => {
    try {
      if (typeof window === "undefined") return process.env.NODE_ENV !== "production"
      const sp = new URLSearchParams(window.location.search)
      if (sp.get("dbg") === "1") return true
      if (localStorage.getItem("pitodo_dbg") === "1") return true
      return process.env.NODE_ENV !== "production"
    } catch {
      return process.env.NODE_ENV !== "production"
    }
  }

  const log = (...args: any[]) => {
    try {
      if (!__dbgEnabled()) return
      // eslint-disable-next-line no-console
      console.log(...args)
    } catch {
      // ignore
    }
  }

  log("[v0] AuthProvider: user state changed to:", user?.username || null)
  log("[v0] AuthProvider version:", AUTH_VERSION)

  useEffect(() => {
		const dbgEnabled = () => {
			try {
				const sp = new URLSearchParams(window.location.search)
				if (sp.get("dbg") === "1") return true
				if (localStorage.getItem("pitodo_dbg") === "1") return true
				return false
			} catch {
				return false
			}
		}
		const dbg = (msg: string, data?: any) => {
			try {
				if (typeof window === "undefined") return
				if (!dbgEnabled()) return
				;(window as any).__PITODO_DBG = (window as any).__PITODO_DBG || []
				;(window as any).__PITODO_DBG.push({ t: Date.now(), msg, data })
			} catch {
				// ignore
			}
		}
		dbg(`Auth init (${AUTH_VERSION})`)
		// Normalize persisted user payloads and guarantee `user.type` exists.
		// This prevents crashes like: undefined is not an object (evaluating 'user.email.split').
		const normalizeUser = (raw: any): User | null => {
			if (!raw || typeof raw !== "object") return null
			const inferredType: "pi" | "email" | undefined =
				(raw.type as any) || (raw.authType as any) || (raw.pi_username ? "pi" : raw.email ? "email" : undefined)
			if (inferredType === "pi") {
				const username = raw.username ?? raw.pi_username ?? ""
				// Prefer internal UUID (public.pi_users.id) when available.
				const uid = raw.piUserId ?? raw.pi_user_id ?? raw.uid ?? raw.pi_uid ?? raw.id ?? ""
				if (!uid) return null
				return {
					type: "pi",
					uid,
					username,
					accessToken: raw.accessToken ?? raw.access_token ?? "",
					isAdmin: Boolean(raw.isAdmin ?? raw.is_admin ?? username === ROOT_ADMIN_USERNAME),
					role: (raw.role ?? raw.user_role ?? "redeemer") as any,
					verificationStatus: (raw.verificationStatus ?? raw.verification_status ?? "unverified") as any,
					// DB contract: member_label in {regular,trusted}; provider_label in {unverified,verified,trusted}
					memberLabel: (raw.memberLabel ?? raw.member_label ?? "regular") as any,
					providerLabel: (raw.providerLabel ?? raw.provider_label ?? "unverified") as any,
					providerApproved: Boolean(raw.providerApproved ?? raw.provider_approved ?? false),
				} as PiUser
			}
			if (inferredType === "email") {
				const uid = raw.uid ?? raw.id ?? ""
				const email = raw.email ?? ""
				if (!uid) return null
				return {
					type: "email",
					uid,
					email,
					username: raw.username ?? email.split("@")[0] ?? "",
					isAdmin: Boolean(raw.isAdmin ?? raw.is_admin ?? false),
					role: (raw.role ?? raw.user_role ?? "redeemer") as any,
					twoFactorEnabled: Boolean(raw.twoFactorEnabled ?? raw.two_factor_enabled ?? false),
					verificationStatus: (raw.verificationStatus ?? raw.verification_status ?? "unverified") as any,
					// DB contract: member_label in {regular,trusted}; provider_label in {unverified,verified,trusted}
					memberLabel: (raw.memberLabel ?? raw.member_label ?? "regular") as any,
					providerLabel: (raw.providerLabel ?? raw.provider_label ?? "unverified") as any,
					providerApproved: Boolean(raw.providerApproved ?? raw.provider_approved ?? false),
				} as EmailUser
			}
			return null
		}

    const loadPiUserFromCookie = async (): Promise<boolean> => {
      if (typeof window === "undefined") return false

      // First check for cookie
      const piUserCookie = getCookie(PI_USER_COOKIE_KEY)
      log("[v0] AuthProvider: Cookie check - pitodo_pi_user:", piUserCookie ? "found" : "not found")

      if (piUserCookie) {
        try {
				const raw = JSON.parse(decodeURIComponent(piUserCookie))
				const normalized = normalizeUser(raw)
				log("[v0] AuthProvider: Parsed user from cookie:", normalized?.username)

				if (normalized && (normalized as any).type === "pi" && normalized.uid) {
					setUser(normalized)
					// Phase 4: update last_login_at for Pi login (no Supabase session)
					ensurePiLoginFlagsOnce(
						String((normalized as any).uid),
						String((normalized as any).username || ""),
						String((raw as any).uid || (raw as any).pi_uid || "")
					)
            setIsLoading(false)
            log("[v0] AuthProvider: Pi user loaded from cookie successfully!")
            return true
          }
        } catch (e) {
          console.error("[v0] AuthProvider: Failed to parse cookie:", e)
          deleteCookie(PI_USER_COOKIE_KEY)
        }
      }

      // Fallback: check for pi_user_id cookie and load from API
      const piUserIdCookie = getCookie("pi_user_id")
      log("[v0] AuthProvider: Cookie check - pi_user_id:", piUserIdCookie ? piUserIdCookie : "not found")

      if (piUserIdCookie) {
        try {
          log("[v0] AuthProvider: Loading user from API with ID:", piUserIdCookie)
          const response = await fetch(`/api/auth/pi-session?id=${encodeURIComponent(piUserIdCookie)}`)

          if (response.ok) {
            const userData = await response.json()
            log("[v0] AuthProvider: Loaded Pi user from API:", userData.piUsername)

						const piUser: PiUser = {
							type: "pi",
							// IMPORTANT: use the internal UUID (pi_users.id) as uid so server-side admin actions
							// (approve provider, create/edit products, etc.) can safely reference provider_id.
							// piUid is still available in the response but MUST NOT be used as our primary uid.
							uid: userData.id,
							piUserId: userData.id,
							username: userData.piUsername,
							accessToken: "",
							isAdmin: Boolean(userData.isAdmin ?? userData.piUsername === ROOT_ADMIN_USERNAME),
							role: userData.userRole as UserRole,
							verificationStatus: userData.verificationStatus,
							providerApproved: Boolean(userData.providerApproved ?? false),
						}

            setUser(piUser)
					// Phase 4: update last_login_at for Pi login (no Supabase session)
					ensurePiLoginFlagsOnce(String(piUser.uid), String(piUser.username || ""))
            setIsLoading(false)
            log("[v0] AuthProvider: Pi user loaded from API successfully!")
            return true
          } else {
            console.error("[v0] AuthProvider: API returned error:", response.status)
            deleteCookie("pi_user_id")
          }
        } catch (error) {
          console.error("[v0] AuthProvider: Error loading from API:", error)
          deleteCookie("pi_user_id")
        }
      }

      return false
    }

    const hasAuthHash = typeof window !== "undefined" && window.location.hash.includes("access_token")
    log("[v0] AuthProvider: hasAuthHash =", hasAuthHash)

    const initializeAuth = async () => {
      try {
        // Step 1: Try to load Pi user from cookie
        const loadedFromCookie = await loadPiUserFromCookie()
        if (loadedFromCookie) {
          log("[v0] AuthProvider: User loaded from cookie - done")
          return
        }

        // Step 2: Check localStorage/sessionStorage as backup
        log("[v0] AuthProvider: Checking localStorage for Pi user...")

        if (typeof window !== "undefined") {
          const sessionUser = sessionStorage.getItem(PI_USER_STORAGE_KEY)
          const localUser = localStorage.getItem(PI_USER_STORAGE_KEY)
          const storedPiUserStr = sessionUser || localUser

          log("[v0] AuthProvider: Storage check:", {
            hasSession: !!sessionUser,
            hasLocal: !!localUser,
          })

          if (storedPiUserStr) {
            try {
						const raw = JSON.parse(storedPiUserStr)
						const parsedPiUser = normalizeUser(raw)
					log("[v0] AuthProvider: Parsed stored user:", {
							uid: (parsedPiUser as any)?.uid,
							username: (parsedPiUser as any)?.username,
							type: (parsedPiUser as any)?.type,
						})

						if (parsedPiUser && (parsedPiUser as any).type === "pi" && parsedPiUser.uid) {
                log("[v0] AuthProvider: Valid Pi user found! Setting user state...")
                setUser(parsedPiUser)
						// Phase 4: update last_login_at for Pi login (no Supabase session)
						// Prefer UUID (pi_users.id) when present; also pass Pi UID for server-side resolution.
						ensurePiLoginFlagsOnce(
							String((parsedPiUser as any).uid),
							String((parsedPiUser as any).username || ""),
							String((raw as any)?.uid || (raw as any)?.pi_uid || "")
						)
                setIsLoading(false)
                log("[v0] AuthProvider: Pi user restored successfully")
                return
              } else {
                log("[v0] AuthProvider: Pi user data invalid, clearing storage")
                sessionStorage.removeItem(PI_USER_STORAGE_KEY)
      sessionStorage.removeItem(PI_USER_ID_STORAGE_KEY)
                localStorage.removeItem(PI_USER_STORAGE_KEY)
      localStorage.removeItem(PI_USER_ID_STORAGE_KEY)
              }
            } catch (parseErr) {
              console.error("[v0] AuthProvider: Failed to parse Pi user:", parseErr)
              sessionStorage.removeItem(PI_USER_STORAGE_KEY)
      sessionStorage.removeItem(PI_USER_ID_STORAGE_KEY)
              localStorage.removeItem(PI_USER_STORAGE_KEY)
      localStorage.removeItem(PI_USER_ID_STORAGE_KEY)
            }
          } else {
            log("[v0] AuthProvider: No Pi user in storage")
          }
        }

        // Step 3: Check Supabase session for email users
        // NOTE: must always reach setIsLoading(false) to avoid infinite loading in Pi Browser / Pi Studio.
        log("[v0] AuthProvider: Checking Supabase session...")

        const supabase = await getSupabaseBrowserClientLazy()

        // Guard: avoid hanging forever if the webview blocks storage/network.
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: any }; error: any }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: { message: "getSession_timeout" } }), 5000)
          ),
        ])

        // If getSession timed out or errored, we still continue and clear loading.
        if (sessionResult?.error) {
          log("[v0] AuthProvider: getSession error/timeout:", sessionResult.error?.message || sessionResult.error)
        }

        const session = sessionResult?.data?.session
        if (session?.user?.email) {
          const sUser = session.user
          log("[v0] AuthProvider: Found Supabase session for:", sUser.email)

          // Ensure user exists in DB (server-side)
          await ensureUserOnce(sUser.email, "email")

          setUser({
            id: sUser.id,
            email: sUser.email,
            name: sUser.user_metadata?.full_name || sUser.email,
            role: "user",
          })
        } else {
          log("[v0] AuthProvider: No Supabase session")
        }
      } catch (error: any) {
        log("[v0] AuthProvider: Error initializing auth:", error)
        setError(error?.message || "Failed to initialize auth")
      } finally {
        setIsLoading(false)
      }
    }

    // Setup auth bootstrap + listener (listener must NOT block loading)
    let authUnsubscribe: (() => void) | null = null
    const setup = async () => {
      await initializeAuth()

      // During Supabase auth redirect, avoid extra work; listener will catch final state.
      const hasAuthHash =
        typeof window !== "undefined" &&
        (window.location.hash?.includes("access_token=") || window.location.hash?.includes("refresh_token="))

      if (hasAuthHash) {
        log("[v0] AuthProvider: Detected auth hash (redirect). Skipping immediate listener setup.")
        return
      }

      try {
        const supabase = await getSupabaseBrowserClientLazy()
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          log("[v0] onAuthStateChange:", event, session?.user?.email || "no user")

          // Supabase email login
          if (event === "SIGNED_IN" && session?.user?.email) {
            const sUser = session.user
            log("[v0] Supabase user signed in:", sUser.email)

            await ensureUserOnce(sUser.email, "email")

            setUser({
              id: sUser.id,
              email: sUser.email!,
              name: sUser.user_metadata?.full_name || sUser.email!,
              role: "user",
            })
          }

          if (event === "SIGNED_OUT") {
            log("[v0] User signed out")
            setUser(null)
          }
        })

        authUnsubscribe = () => authListener.subscription.unsubscribe()
      } catch (e: any) {
        log("[v0] AuthProvider: Failed to setup auth listener:", e?.message || e)
      }
    }

    void setup()

    return () => {
      if (authUnsubscribe) authUnsubscribe()
    }
  }, [])

  const loginWithPi = async (): Promise<{ success: boolean; piUserId?: string }> => {
    try {
      log("[v0] loginWithPi: === STARTING PI LOGIN FLOW ===")
      piLoginInProgressRef.current = true

      log("[v0] loginWithPi: Calling signInWithPi()...")
      // IMPORTANT: Payments require the "payments" scope; without it Pi SDK will throw
      // "Cannot create a payment without \"payments\" scope".
      // This does NOT change UI, only requests the required permission from Pi.
      const piAuthResult = await signInWithPi(["username", "payments"])

      log("[v0] loginWithPi: Pi SDK auth completed:", {
        hasAccessToken: !!piAuthResult?.accessToken,
        hasUser: !!piAuthResult?.user,
        uid: piAuthResult?.user?.uid,
        username: piAuthResult?.user?.username,
      })

      if (!piAuthResult || !piAuthResult.user) {
        console.error("[v0] loginWithPi: NO RESULT from signInWithPi")
        piLoginInProgressRef.current = false
        throw new Error("Pi authentication failed - no result")
      }

      const piUser = piAuthResult.user
      const accessToken = piAuthResult.accessToken

      if (!piUser.uid || !piUser.username) {
        console.error("[v0] loginWithPi: Pi user data incomplete:", piUser)
        piLoginInProgressRef.current = false
        throw new Error("Pi user data incomplete")
      }

      log("[v0] loginWithPi: Pi user data validated. Calling backend API...")

      const storedUserData = await (await getQueriesLazy()).createOrUpdatePiUser({
        piUid: piUser.uid,
        piUsername: piUser.username,
        accessToken: accessToken,
      })

      log("[v0] loginWithPi: Backend returned user data:", storedUserData)

				const userData: PiUser = {
					// ✅ Persist the internal UUID (public.pi_users.id) as the primary uid for app state.
					// Pi SDK uid is kept via `piUid` (returned from server) so we don't lose it.
					uid: storedUserData?.id || piUser.uid,
					username: piUser.username,
					accessToken: accessToken || "",
					type: "pi",
					// ✅ internal UUID in public.pi_users (used for PITD wallet + reviews)
					piUserId: storedUserData?.id || null,
					isAdmin: piUser.username === ROOT_ADMIN_USERNAME,
					role: (storedUserData?.userRole as UserRole) || "redeemer",
					verificationStatus: storedUserData?.verificationStatus || "unverified",
				}

      log("[v0] loginWithPi: Created userData object:", userData)

      try {
        const userDataJson = JSON.stringify(userData)
        sessionStorage.setItem(PI_USER_STORAGE_KEY, userDataJson)
        localStorage.setItem(PI_USER_STORAGE_KEY, userDataJson)
        if (userData.piUserId) {
          // Keep compatibility: write both legacy and newer PITODO keys.
          const _piUserId = String(userData.piUserId)
          try { localStorage.setItem(PI_USER_ID_STORAGE_KEY, _piUserId) } catch {}
          try { sessionStorage.setItem(PI_USER_ID_STORAGE_KEY, _piUserId) } catch {}
          try { localStorage.setItem(PITODO_PI_USER_ID_STORAGE_KEY, _piUserId) } catch {}
          try { sessionStorage.setItem(PITODO_PI_USER_ID_STORAGE_KEY, _piUserId) } catch {}

          // Also persist username/type keys used by some pages for API headers.
          const _piUsername = String(userData.piUsername || "")
          if (_piUsername) {
            try { localStorage.setItem(PITODO_PI_USERNAME_STORAGE_KEY, _piUsername) } catch {}
            try { sessionStorage.setItem(PITODO_PI_USERNAME_STORAGE_KEY, _piUsername) } catch {}
          }
          try { localStorage.setItem(PITODO_USER_TYPE_STORAGE_KEY, "pi") } catch {}
          try { sessionStorage.setItem(PITODO_USER_TYPE_STORAGE_KEY, "pi") } catch {}
        }
        log("[v0] loginWithPi: Saved to storage (backup)")
      } catch (e) {
        console.warn("[v0] loginWithPi: Storage save failed (non-critical)")
      }

      log("[v0] loginWithPi: Setting user state in AuthContext...")
      setUser(userData)

      // Phase 4: record last_login_at immediately for Pi users.
      // (Pi Browser has limited console access, so this keeps DB in sync.)
      ensurePiLoginFlagsOnce(
        String(userData.piUserId || piUser.uid),
        String(piUser.username || ""),
        String(piUser.uid || "")
      )

      piLoginInProgressRef.current = false
      log("[v0] loginWithPi: === PI LOGIN FLOW COMPLETE - SUCCESS ===")
      log("[v0] loginWithPi: User state updated, LoginPage should detect and redirect")

      return { success: true, piUserId: storedUserData.id }
    } catch (error: any) {
      console.error("[v0] loginWithPi: === PI LOGIN FLOW FAILED ===", error)
      piLoginInProgressRef.current = false
      throw error
    }
  }

  const loginWithEmail = async (emailOrUsername: string, password: string, totpCode?: string): Promise<void> => {
    log("[v0] loginWithEmail: starting for", emailOrUsername)

    const supabase = await getSupabaseBrowserClientLazy()
    let email = emailOrUsername

    if (!emailOrUsername.includes("@")) {
      log("[v0] loginWithEmail: looking up username")

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Không tìm thấy tài khoản với username này")
      }

      email = result.email
      log("[v0] loginWithEmail: found email", email)
    }

    log("[v0] loginWithEmail: signing in with password")
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error("[v0] loginWithEmail: auth error", error)
      throw new Error(error.message === "Invalid login credentials" ? "Email hoặc mật khẩu không đúng" : error.message)
    }

    if (!data.user) {
      throw new Error("Login failed")
    }

    log("[v0] loginWithEmail: auth success for", data.user.email)

    const piUserData = await ensurePiUserRecord(data.user)
    if (piUserData) {
      const emailUser = createEmailUserFromData(piUserData, data.user.email || "")
      log("[v0] loginWithEmail: Setting user directly:", emailUser.username)
      setUser(emailUser)
      lastProcessedUserIdRef.current = data.user.id
    }
  }

  const registerWithEmail = async (data: {
    username: string
    email: string
    password: string
    fullName: string
    phoneNumber: string
    address: string
  }) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Registration failed")
    }

    return result
  }

  const verifyEmail = async (token: string): Promise<void> => {
    const supabase = await getSupabaseBrowserClientLazy()
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "email" })
    if (error) throw error
  }

  const setupTwoFactor = async (): Promise<{ secret: string; qrCode: string }> => {
    throw new Error("2FA setup not implemented")
  }

  const enableTwoFactor = async (totpCode: string): Promise<void> => {
    if (!user) throw new Error("Not logged in")
    const supabase = await getSupabaseBrowserClientLazy()
    await (await getQueriesLazy()).enableUser2FA(supabase, user.uid, totpCode)
  }

  const applyAsProvider = async (businessName: string, description: string): Promise<void> => {
    if (!user) throw new Error("Not logged in")
    const supabase = await getSupabaseBrowserClientLazy()
    await (await getQueriesLazy()).applyForProvider(supabase, user.uid, businessName, description)
  }

  const approveProviderApplication = async (
    providerId: string,
    action: "approve" | "reject",
    reason?: string,
  ): Promise<void> => {
    if (!user || !isAdmin()) throw new Error("Not authorized")
    const supabase = await getSupabaseBrowserClientLazy()
    await (await getQueriesLazy()).approveProvider(supabase, providerId, action, reason)
  }

  const getPendingProviderApplications = async (): Promise<any[]> => {
    if (!user || !isAdmin()) throw new Error("Not authorized")
    const supabase = await getSupabaseBrowserClientLazy()
    return (await getQueriesLazy()).getPendingProviders(supabase)
  }

  const logout = () => {
    log("[v0] logout: Logging out user...")
    getSupabaseBrowserClientLazy().then((supabase) => supabase.auth.signOut())
    localStorage.removeItem(PI_USER_STORAGE_KEY)
    localStorage.removeItem(PI_USER_ID_STORAGE_KEY)
    localStorage.removeItem(PITODO_PI_USER_ID_STORAGE_KEY)
    localStorage.removeItem(PITODO_PI_USERNAME_STORAGE_KEY)
    localStorage.removeItem(PITODO_USER_TYPE_STORAGE_KEY)
    sessionStorage.clear()
    deleteCookie(PI_USER_COOKIE_KEY)
    deleteCookie("pi_user_id")
    setUser(null)
    log("[v0] logout: Complete")
  }

  const isAdmin = () => {
    if (!user) return false
    return user.role === "root_admin" || user.role === "admin" || user.username === ROOT_ADMIN_USERNAME
  }

  const isProvider = () => {
    if (!user) return false
    return user.role === "provider" || isAdmin()
  }

  const handleCreatePiPayment = async (amount: number, memo: string, metadata: any) => {
    return createPiPayment(amount, memo, metadata)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithPi,
        loginWithEmail,
        registerWithEmail,
        verifyEmail,
        setupTwoFactor,
        enableTwoFactor,
        applyAsProvider,
        approveProviderApplication,
        getPendingProviderApplications,
        logout,
        isAdmin,
        isProvider,
        createPiPayment: handleCreatePiPayment,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// =========================================================
// ✅ Prevent request bursts to /api/auth/ensure-user.
// Pi Studio/Pi Browser may proxy requests through a rate-limited CORS endpoint,
// so concurrent calls can easily hit 429 and break JSON parsing.
// We dedupe concurrent calls per userId and cache per session via sessionStorage.
// =========================================================
const __ensureUserInflight = new Map<string, Promise<any>>()

// =========================================================
// ✅ Best-effort sync for Pi login (no Supabase session).
// Pi login does not create a Supabase Auth session, so ensurePiUserRecord(authUser)
// will never run. We still want to update public.users.last_login_at (Phase 4)
// for Pi users using the existing /api/auth/ensure-user server route.
//
// Rules:
// - Never break login/UI if this fails.
// - Do NOT change the Pi login flow.
// - Run at most once per browser session per Pi user to avoid request bursts.
// =========================================================
const __ensurePiLoginSynced = new Set<string>()

// Sync login flags for Pi users.
// IMPORTANT: pass the *UUID* (pi_users.id / public.users.id) when available.
// Older localStorage payloads may only contain Pi UID; we send it as metadata.pi_uid so the server can resolve.
const ensurePiLoginFlagsOnce = async (piUserIdOrUid: string, piUsername?: string, piUid?: string) => {
  try {
    if (!piUserIdOrUid) return
    if (__ensurePiLoginSynced.has(piUserIdOrUid)) return
    __ensurePiLoginSynced.add(piUserIdOrUid)

    // Session-scoped cache to survive component remounts.
    const cacheKey = `ensure_pi_login_${piUserIdOrUid}`
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached === "1") return
      sessionStorage.setItem(cacheKey, "1")
    }

    // Best-effort: userId + metadata helps lookup/consistency.
    await fetch("/api/auth/ensure-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: piUserIdOrUid,
        email: null,
        metadata: { from_pi: true, username: piUsername || null, pi_uid: piUid || null },
      }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}

const ensurePiUserRecord = async (authUser: any): Promise<any> => {
  const uid = authUser?.id ? String(authUser.id) : ""
  if (uid) {
    const existing = __ensureUserInflight.get(uid)
    if (existing) return existing
  }

  const run = (async () => {
    const debugEnabled = (() => {
      try {
        return new URLSearchParams(window.location.search).get("debug") === "1"
      } catch {
        return false
      }
    })()

    log("[v0] ensurePiUserRecord: starting for", authUser.id, authUser.email)

    // Session cache exists to prevent rapid repeated calls on Pi Browser (can cause 429).
    // But provider approval / role changes must reflect quickly, so we use a short TTL.
    const cacheKey = `piuser_${authUser.id}`
    const CACHE_TTL_MS = 3_000
    const cachedRaw = sessionStorage.getItem(cacheKey)
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw)
        // Backward compatible: old cache stored the user object directly.
        const cachedObj = parsed && parsed.data ? parsed.data : parsed
        const cachedAt = parsed && typeof parsed.t === "number" ? parsed.t : 0
        const age = cachedAt ? Date.now() - cachedAt : Number.POSITIVE_INFINITY
        if (cachedObj && (cachedObj.id || cachedObj.uid) && age <= CACHE_TTL_MS) {
          log("[v0] ensurePiUserRecord: returning cached data (age ms)", age)
          return cachedObj
        }
      } catch {
        // ignore corrupted cache
      }
      sessionStorage.removeItem(cacheKey)
    }

    try {
      const response = await fetch(debugEnabled ? "/api/auth/ensure-user?debug=1" : "/api/auth/ensure-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.id,
          email: authUser.email,
          metadata: {
            ...authUser.user_metadata,
            email_confirmed_at: authUser.email_confirmed_at,
          },
        }),
      })

      // NOTE: In Pi wrapper, 429 may return a non-JSON body like "Too Many Requests".
      // Never attempt response.json() unless we are confident it's JSON.
      if (response.status === 429) {
        console.warn("[v0] ensurePiUserRecord: Rate limited, using fallback data")
        const fallbackData = {
          id: authUser.id,
          pi_uid: `EMAIL-${authUser.id}`,
          pi_username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "user",
          email: authUser.email,
          user_role: "redeemer",
          verification_status: authUser.email_confirmed_at ? "verified" : "pending",
        }
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: fallbackData }))
        return fallbackData
      }

      if (!response.ok) {
        console.error("[v0] ensurePiUserRecord: API error", response.status)
        const fallbackData = {
          id: authUser.id,
          pi_uid: `EMAIL-${authUser.id}`,
          pi_username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "user",
          email: authUser.email,
          user_role: "redeemer",
          verification_status: "pending",
        }
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: fallbackData }))
        return fallbackData
      }

      const text = await response.text()
      let piUserData: any = null
      try {
        piUserData = JSON.parse(text)
      } catch {
        console.error("[v0] ensurePiUserRecord: non-JSON response")
      }

      if (!piUserData) {
        const fallbackData = {
          id: authUser.id,
          pi_uid: `EMAIL-${authUser.id}`,
          pi_username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "user",
          email: authUser.email,
          user_role: "redeemer",
          verification_status: authUser.email_confirmed_at ? "verified" : "pending",
        }
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: fallbackData }))
        return fallbackData
      }

      log("[v0] ensurePiUserRecord: success", piUserData.pi_username)
      sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: piUserData }))
      return piUserData
    } catch (err) {
      console.error("[v0] ensurePiUserRecord: exception", err)
      const fallbackData = {
        id: authUser.id,
        pi_uid: `EMAIL-${authUser.id}`,
        pi_username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "user",
        email: authUser.email,
        user_role: "redeemer",
        verification_status: "pending",
      }
      sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: fallbackData }))
      return fallbackData
    }
  })()

  if (uid) __ensureUserInflight.set(uid, run)
  try {
    return await run
  } finally {
    if (uid) __ensureUserInflight.delete(uid)
  }
}

const createEmailUserFromData = (piUserData: any, email: string): EmailUser => {
  return {
    uid: piUserData.id,
    // Avoid crashing if email is missing (defensive; email auth should normally include it)
    username: piUserData.pi_username || (email ? email.split("@")[0] : "User"),
    type: "email",
    role: (piUserData.user_role as UserRole) || "redeemer",
    piUserId: piUserData.id,
    email: email,
    fullName: piUserData.full_name || piUserData.pi_username || "",
    verificationStatus: piUserData.verification_status || "pending",
    isAdmin: !!piUserData.is_admin,
    twoFactorEnabled: piUserData.two_factor_enabled || false,
    // Phase 1 labels must be present so Account can show badges immediately after admin updates.
    memberLabel: (piUserData as any)?.member_label === "trusted" ? "trusted" : "regular",
    providerLabel: (((piUserData as any)?.provider_label as any) || "unverified") as any,
    providerApproved: Boolean((piUserData as any)?.provider_approved ?? false),
  }
}
