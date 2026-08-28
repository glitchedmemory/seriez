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

/**
 * Resolve the authenticated user's auth.uid() (Supabase Auth id).
 * This is the canonical identifier that media_trackings.username stores
 * and that the RLS policy (auth.uid()::text = username) checks against.
 */
export async function resolveAuthUid(req: NextRequest): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {}
  return null;
}

/** Allowed roles for staff actions */
export const STAFF_ROLES = ["admin", "moderator"] as const;

/** Only admin can sanction */
export const ADMIN_ONLY = ["admin"] as const;
