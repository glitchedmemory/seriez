export const revalidate = 86400;

import { redirect } from "next/navigation";
import { getAnilistId } from "@/lib/anilist";
import { getMovieInfo, getTVInfo, resolveConflict } from "@/lib/title-utils";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

// Legacy /title/[id] route — redirects to the new split routes.
// Deterministic redirects (?type=, /season/) are handled in proxy.ts (301).
// Type-less access is resolved here (needs TMDB fetch — can't run in Edge proxy).
export default async function TitleRedirect({ params, searchParams }: Props) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const numId = parseInt(id);
  if (isNaN(numId)) redirect("/404");

  // Anime (fallback if proxy didn't catch it)
  if (type === "anime") {
    const anilistId = await getAnilistId(numId);
    if (anilistId) redirect(`/anime/${numId}`);
  }

  // Type-less: resolve movie/TV conflict by popularity (vote_count)
  const resolved = await resolveConflict(numId);
  const movie = await getMovieInfo(numId);
  const tv = await getTVInfo(numId);

  if (resolved === "tv" && tv) {
    redirect(`/tv/${numId}/season/1`);
  }
  if (movie) {
    redirect(`/movie/${numId}`);
  }
  if (tv) {
    redirect(`/tv/${numId}/season/1`);
  }

  redirect("/404");
}
