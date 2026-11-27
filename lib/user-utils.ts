import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export function usernameToUUID(username: string): string {
  const hash = crypto.createHash("sha256").update("seriez:" + username).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// In-process cache: username -> id.
//
// Every profile-page API resolves the same username independently, so opening
// /profile issued this lookup ~12 times and each miss costs a full Supabase
// round-trip (~230ms). A single hit here removes that for all of them.
//
// ⚠️ INVALIDATION IS MANDATORY WHEN USERNAMES BECOME EDITABLE.
// The id is stable across renames, so a stale entry cannot show the wrong
// person — but it DOES keep the old name resolvable, i.e. /OldName keeps
// serving that user after they rename. Any rename endpoint must call
// invalidateUserCache(oldUsername). The 60s TTL is only a backstop for a
// missed call; it is not the intended invalidation path.
//
// Only successful id lookups are cached. "No such user" is never cached, since
// this function creates the row on a miss and a cached negative would block a
// brand-new signup.
const USER_CACHE_TTL_MS = 60 * 1000;
const userCache = new Map<string, { id: string; exp: number }>();

export function invalidateUserCache(username?: string): void {
  if (username) userCache.delete(username.trim().slice(0, 20));
  else userCache.clear();
}

export async function resolveUserId(username: string): Promise<string | null> {
  const trimmed = username.trim().slice(0, 20);
  if (!trimmed) return null;

  const cached = userCache.get(trimmed);
  if (cached) {
    if (cached.exp > Date.now()) return cached.id;
    userCache.delete(trimmed);
  }

  const userId = usernameToUUID(trimmed);
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", trimmed)
    .maybeSingle();

  if (existing) {
    userCache.set(trimmed, { id: existing.id, exp: Date.now() + USER_CACHE_TTL_MS });
    return existing.id;
  }

  const { error: insertErr } = await supabase
    .from("users")
    .insert({ id: userId, username: trimmed, email: `${trimmed}@seriezuser.com` });

  if (insertErr) {
    // 23505 = unique violation: a concurrent request created the row between
    // our SELECT and INSERT. Re-read instead of returning a synthetic id.
    const { data: raced } = await supabase
      .from("users")
      .select("id")
      .eq("username", trimmed)
      .maybeSingle();
    if (raced) {
      userCache.set(trimmed, { id: raced.id, exp: Date.now() + USER_CACHE_TTL_MS });
      return raced.id;
    }
  }

  userCache.set(trimmed, { id: userId, exp: Date.now() + USER_CACHE_TTL_MS });
  return userId;
}
