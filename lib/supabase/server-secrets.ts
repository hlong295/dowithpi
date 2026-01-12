// SERVER-ONLY secrets for Pi App Studio / pinet hosting.
//
// IMPORTANT SECURITY NOTES:
// - Do NOT import this module into any client component.
// - Do NOT expose these values via NEXT_PUBLIC_*.
// - This file is meant to be edited locally before uploading to Pi App Studio.
//
// Supabase project URL + ANON key are already hard-coded in lib/supabase/config.ts.
// For Pi App Studio hosting, environment variables are often unavailable, so we
// provide a server-only fallback for the Service Role key.

/**
 * Supabase Service Role Key (JWT with role=service_role).
 *
 * You MUST paste your project's SERVICE_ROLE key here for Pi App Studio builds.
 * This key must never be used on the client.
 */
export const STUDIO_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA2NjA4MiwiZXhwIjoyMDgwNjQyMDgyfQ.CLNeaPyAXRg-Gacc2A93YINxqip60WrlMD2mcop245k";
