// Root Admin constants + helpers (TSBIO constitution)

export const ROOT_EMAIL = "dowithpi@gmail.com";
export const ROOT_USERNAME = "hlong295"; // email-namespace username

export function isRootIdentity(input: {
  email?: string | null;
  username?: string | null;
  role?: string | null;
}): boolean {
  const email = (input.email || "").toLowerCase();
  const username = (input.username || "").toLowerCase();
  const role = (input.role || "").toLowerCase();

  // Primary: DB role
  if (role === "root_admin") return true;

  // Safety backstop: fixed root email/username (until DB lock is confirmed)
  return email === ROOT_EMAIL || username === ROOT_USERNAME;
}
