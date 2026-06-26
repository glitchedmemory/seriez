"use client";

import { useState, useEffect, useCallback } from "react";

interface HiddenItem {
  type: "review" | "comment" | "collection";
  id: string | number;
  username: string;
  content: string;
  ai_verdict?: string;
  created_at: string;
  tmdb_id?: number;
  media_type?: string;
  is_public?: boolean;
  is_published?: boolean;
  item_count?: number;
  report_count?: number;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function ModerationPage() {
  const [items, setItems] = useState<HiddenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"review"|"comment"|"collection">("all");
  const [verdicts, setVerdicts] = useState<Record<string,string>>({});
  const [analyzingId, setAnalyzingId] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        let all: HiddenItem[] = [
          ...(data.reviews||[]).map((r:any)=>({...r,type:"review" as const})),
          ...(data.comments||[]).map((c:any)=>({...c,type:"comment" as const})),
        ];
        try {
          const cr = await fetch("/api/admin/content?type=collection&limit=100");
          if (cr.ok) {
            const cd = await cr.json();
            if (cd.results) all.push(...cd.results.map((c:any)=>({...c,type:"collection" as const,id:c.id})));
          }
        } catch {}
        all.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
        setItems(all);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(()=>{load();},[load]);

  async function handleAction(item:HiddenItem,action:"restore"|"delete") {
    const res = await fetch(`/api/admin/reports?action=${action}&target_type=${item.type}&target_id=${item.id}`);
    if (res.ok) setItems(prev=>prev.filter(i=>i.id!==item.id||i.type!==item.type));
  }

  async function handleAnalyze(item:HiddenItem) {
    const key = `${item.type}-${item.id}`;
    setAnalyzingId(key);
    try {
      const r = await fetch("/api/admin/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:item.content,target_type:item.type,target_id:String(item.id)})});
      if (r.ok) { const d = await r.json(); setVerdicts(prev=>({...prev,[key]:d.verdict})); }
    } catch {}
    setAnalyzingId(null);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Moderation</h1>
      <p className="text-sm text-[#71717a] mb-6">Review flagged content and take action</p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[#71717a]">Filter:</span>
        {["all","review","comment","collection"].map(f=>(
          <button key={f} onClick={()=>setFilter(f as typeof filter)}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
              filter===f ? "bg-[#6366f1]/15 text-[#6366f1]" : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}>
            {f==="all"?"All":f==="review"?"Reviews":f==="comment"?"Comments":"Collections"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Loading reports...</p>
      ) : items.filter(i=>filter==="all"||i.type===filter).length===0 ? (
        <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-10 text-center">
          <p className="text-[#71717a] text-sm">No flagged content. All clear.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.filter(i=>filter==="all"||i.type===filter).map(item=>{
            const key=`${item.type}-${item.id}`;
            const v=verdicts[key]||item.ai_verdict;
            const typeColor=item.type==="review"?"#3b82f6":item.type==="comment"?"#8b5cf6":"#f59e0b";
            return (
              <div key={key} className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border" style={{color:typeColor,borderColor:typeColor+"33",background:typeColor+"11"}}>
                      {item.type==="review"?"Review":item.type==="comment"?"Comment":"Collection"}
                    </span>
                    <span className="text-sm text-[#a1a1aa]">{item.username}</span>
                    <span className="text-xs text-[#52525b]">{fmtDate(item.created_at)}</span>
                    {(item.report_count??0)>=3&&(
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ef4444]/15 text-[#ef4444]">{(item.report_count??0)} reports</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>handleAnalyze(item)} disabled={analyzingId===key}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 disabled:opacity-50 transition-colors">
                      {analyzingId===key?"Analyzing...":"Analyze"}
                    </button>
                    <button onClick={()=>handleAction(item,"restore")}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">Restore</button>
                    <button onClick={()=>handleAction(item,"delete")}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors">Delete</button>
                  </div>
                </div>
                {item.type==="collection"?(
                  <div className="flex gap-4 text-xs text-[#71717a]">
                    <span>{item.content}</span><span>{item.item_count??0} items</span>
                    <span>{item.is_public?"Public":"Private"}</span>
                    {item.is_published&&<span>Published</span>}
                  </div>
                ):(
                  <p className="text-sm text-[#d4d4d8] bg-[#111118] rounded-xl p-3 whitespace-pre-wrap">{item.content}</p>
                )}
                {v&&item.type!=="collection"&&(
                  <div className={`mt-3 text-xs p-3 rounded-xl ${
                    v.includes("DELETE")?"bg-[#ef4444]/5 text-[#ef4444] border border-[#ef4444]/15":
                    v.includes("RESTORE")?"bg-[#22c55e]/5 text-[#22c55e] border border-[#22c55e]/15":
                    "bg-[#f59e0b]/5 text-[#f59e0b] border border-[#f59e0b]/15"
                  }`}>{v}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
