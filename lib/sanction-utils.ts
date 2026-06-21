import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SanctionInfo {
  type: string | null;
  reason: string | null;
  until: string | null;
}

/**
 * Check if a user is sanctioned. Returns sanction info, or null if not sanctioned.
 * Automatically expires temporary suspensions that have passed their deadline.
 */
export async function checkSanction(username: string): Promise<SanctionInfo | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("sanction_type, sanction_reason, sanction_until")
    .eq("username", username)
    .maybeSingle();

  if (!data || !data.sanction_type) return null;

  // Auto-expire temporary suspension
  if (data.sanction_type === "suspended" && data.sanction_until) {
    if (new Date(data.sanction_until) < new Date()) {
      await supabaseAdmin.from("users").update({
        sanction_type: null, sanction_reason: null,
        sanction_until: null, sanctioned_at: null, sanctioned_by: null,
      }).eq("username", username);
      return null;
    }
  }

  return { type: data.sanction_type, reason: data.sanction_reason, until: data.sanction_until };
}

/**
 * Check sanction and return appropriate error response if user is restricted.
 * - banned: always blocked
 * - suspended: blocked for write operations
 * - warned: allowed (just a warning)
 * - comment_restricted: blocked for comment operations only
 */
export function getSanctionError(sanction: SanctionInfo | null, action: "write" | "comment"): string | null {
  if (!sanction) return null;
  if (sanction.type === "banned") return "Your account has been permanently banned.";
  if (sanction.type === "suspended") {
    const untilStr = sanction.until ? ` until ${new Date(sanction.until).toLocaleDateString()}` : "";
    return `Your account is suspended${untilStr}.`;
  }
  if (sanction.type === "comment_restricted" && action === "comment") {
    return "Your commenting privileges have been restricted.";
  }
  return null;
}
