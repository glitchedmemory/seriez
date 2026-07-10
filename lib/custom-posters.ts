import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "custom_posters";

export async function getCustomPoster(
  tmdbId: number
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from(TABLE)
      .select("poster_url")
      .eq("tmdb_id", tmdbId)
      .single();

    return data?.poster_url || null;
  } catch {
    return null;
  }
}

export async function upsertCustomPoster(
  tmdbId: number,
  posterUrl: string,
  mediaType: "tv" | "movie"
): Promise<{ success: true } | { error: string }> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { tmdb_id: tmdbId, poster_url: posterUrl, media_type: mediaType },
        { onConflict: "tmdb_id" }
      );

    if (error) return { error: error.message };
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Failed to save poster" };
  }
}
