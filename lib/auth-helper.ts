import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

/**
 * Resolve the effective username for this request.
 */
export async function resolveUsername(req: NextRequest): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.username) {
      return data.user.user_metadata.username as string;
    }
  } catch {}
  return null;
}

/** Allowed roles for staff actions */
export const STAFF_ROLES = ["admin", "moderator"] as const;

/** Only admin can sanction */
export const ADMIN_ONLY = ["admin"] as const;
