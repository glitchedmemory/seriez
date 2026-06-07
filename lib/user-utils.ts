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

export async function resolveUserId(username: string): Promise<string | null> {
  const trimmed = username.trim().slice(0, 20);
  if (!trimmed) return null;

  const userId = usernameToUUID(trimmed);
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", trimmed)
    .maybeSingle();

  if (existing) return existing.id;

  const { error: insertErr } = await supabase
    .from("users")
    .insert({ id: userId, username: trimmed, email: `${trimmed}@seriezuser.com` });

  return userId;
}
