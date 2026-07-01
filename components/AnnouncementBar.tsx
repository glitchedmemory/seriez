import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AnnouncementBar() {
  let data = null;
  try {
    const supabase = await createClient();
    const result = await supabase
      .from("announcements")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    data = result.data;
  } catch {
    return null;
  }

  if (!data?.text) return null;

  return (
    <Link
      href={data.link || "/"}
      className="block w-full bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#a855f7] text-white text-sm font-medium hover:brightness-110 transition-all"
    >
      <div className="flex items-center justify-center px-4 py-2.5 gap-2">
        <span className="truncate max-w-full text-center">
          {data.text}
        </span>
        {data.link_text && (
          <span className="whitespace-nowrap shrink-0 underline underline-offset-2 font-semibold">
            {data.link_text}
          </span>
        )}
      </div>
    </Link>
  );
}
