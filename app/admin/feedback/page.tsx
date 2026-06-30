import { createClient } from "@/lib/supabase/server";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("id, message, username, created_at, page")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = feedback || [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Feedback</h1>
        <p className="text-sm text-[#71717a] mt-1">{items.length} submissions</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-[#71717a] text-sm">No feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((f: any) => (
            <div key={f.id} className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-white">{f.username || "anonymous"}</span>
                <span className="text-[10px] text-[#71717a]">
                  {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
                {f.page && (
                  <span className="text-[10px] text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded-full ml-auto">
                    {f.page}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#d1d5db] leading-relaxed whitespace-pre-wrap">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
