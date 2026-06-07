import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

/**
 * Resolve the effective username for this request.
 * - Requires Supabase session authentication
 * - Returns null if not authenticated
 */
export async function resolveUsername(req: NextRequest): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.username) {
      return data.user.user_metadata.username as string;
    }
  } catch {
    // Session fetch failed
  }

  return null;
}
