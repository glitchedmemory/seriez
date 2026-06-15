import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  try {
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("tmdb_id, media_type, content, rating, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    return NextResponse.json({ reviews: reviews || [] });
  } catch (err: any) {
    console.error("Reviews fetch error:", err);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
