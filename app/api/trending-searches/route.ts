import { getTrending } from "@/lib/tmdb";

export async function GET() {
  try {
    const items = await getTrending();
    const searches = items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
    }));
    return Response.json({ searches });
  } catch {
    return Response.json({ searches: [] });
  }
}
