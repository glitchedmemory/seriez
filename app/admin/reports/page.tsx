"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Tab = "reports" | "sanctions" | "audit";

interface HiddenItem {
  type: "review" | "comment" | "collection";
  id: string | number;
  username: string;
  content: string;
  ai_verdict?: string;
  created_at: string;
  tmdb_id?: number;
  media_type?: string;
  review_id?: string;
  is_public?: boolean;
  is_published?: boolean;
  item_count?: number;
  report_count?: number;
}

interface UserInfo {
  username: string;
  role: string;
  is_premium: boolean;
  created_at: string;
  sanction_type?: string | null;
  sanction_until?: string | null;
  sanctioned_at?: string | null;
}

interface AuditEntry {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  admin_username: string;
  created_at: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

const tabs: { id: Tab; label: string }[] = [
  { id: "reports", label: "Reports" },
  { id: "sanctions", label: "Sanctions" },
  { id: "audit", label: "Audit Log" },
];

const DURATION_UNITS = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
];

function AdminReportsContent() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "reports");

  // Reports
  const [items, setItems] = useState<HiddenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"review"|"comment"|"collection">("all");
  const [verdicts, setVerdicts] = useState<Record<string,string>>({});
  const [analyzingId, setAnalyzingId] = useState<string|null>(null);

  // Sanctions
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selUser, setSelUser] = useState("");
  const [sancType, setSancType] = useState("warned");
  const [sancReason, setSancReason] = useState("");
  const [sancDurVal, setSancDurVal] = useState(1);
  const [sancDurUnit, setSancDurUnit] = useState("days");
  const [sancLoading, setSancLoading] = useState(false);
  const [sancMsg, setSancMsg] = useState("");

  // Audit
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");

  const loadReports = useCallback(async () => {
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

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/users");
      if (r.ok) { const d = await r.json(); setUsers(d.users||[]); }
    } catch {}
  }, []);

  const loadAudit = useCallback(async (offset=0) => {
    setAuditLoading(true);
    try {
      const p = new URLSearchParams({limit:"50",offset:String(offset)});
      if (auditFilter) p.set("action",auditFilter);
      const r = await fetch("/api/admin/audit-log?"+p.toString());
      if (r.ok) { const d = await r.json(); setAudit(d.actions||[]); setAuditTotal(d.total||0); }
    } catch {}
    setAuditLoading(false);
  }, [auditFilter]);

  useEffect(()=>{loadReports();},[loadReports]);
  useEffect(()=>{if(tab==="sanctions"&&users.length===0)loadUsers();},[tab,users.length,loadUsers]);
  useEffect(()=>{if(tab==="audit"&&audit.length===0)loadAudit();},[tab,audit.length,loadAudit]);

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

  async function applySanction() {
    if (!selUser) return;
    setSancLoading(true); setSancMsg("");
    const body: any = { username:selUser, sanction_type:sancType, reason:sancReason||undefined };
    if (sancType==="suspended") {
      if (sancDurUnit==="hours") body.duration_hours = sancDurVal;
      else if (sancDurUnit==="days") body.duration_days = sancDurVal;
      else body.duration_months = sancDurVal;
    }
    try {
      const r = await fetch("/api/admin/sanction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d = await r.json();
      if (r.ok) { setSancMsg("Sanction applied to "+selUser); setSelUser(""); setSancReason(""); loadUsers(); }
      else setSancMsg(d.error);
    } catch { setSancMsg("Failed"); }
    setSancLoading(false);
  }

  async function removeSanction() {
    if (!selUser) return;
    setSancLoading(true); setSancMsg("");
    try {
      const r = await fetch("/api/admin/sanction",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:selUser})});
      const d = await r.json();
      if (r.ok) { setSancMsg("Sanction removed from "+selUser); setSelUser(""); loadUsers(); }
      else setSancMsg(d.error);
    } catch { setSancMsg("Failed"); }
    setSancLoading(false);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Moderation</h1>
        <p className="text-sm text-[#71717a] mt-1">Review content, manage sanctions, and track admin actions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a0a14] rounded-xl p-1 border border-[#1a1a2e] mb-6 w-fit">
        {tabs.map(t=>(
          <button
            key={t.id}
            onClick={()=>setTab(t.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
              tab===t.id ? "bg-[#6366f1] text-white shadow-sm" : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === REPORTS TAB === */}
      {tab==="reports"&&(
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#71717a]">Filter:</span>
            {["all","review","comment","collection"].map(f=>(
              <button
                key={f}
                onClick={()=>setFilter(f as typeof filter)}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                  filter===f ? "bg-[#6366f1]/15 text-[#6366f1]" : "text-[#71717a] hover:text-[#a1a1aa]"
                }`}
              >
                {f==="all"?"All":f==="review"?"Reviews":f==="comment"?"Comments":"Collections"}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-[#71717a]">Loading reports...</p>
          ) : items.filter(i=>filter==="all"||i.type===filter).length===0 ? (
            <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-10 text-center">
              <p className="text-[#71717a] text-sm">No flagged content — everything&apos;s clean</p>
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
                        <span>{item.content}</span>
                        <span>{item.item_count??0} items</span>
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
                      }`}>
                        {v}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === SANCTIONS TAB === */}
      {tab==="sanctions"&&(
        <div className="max-w-xl">
          <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6 mb-6">
            <h3 className="font-semibold text-white mb-5">Apply Sanction</h3>

            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">User</label>
            <select value={selUser} onChange={e=>setSelUser(e.target.value)}
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-xl px-4 py-2.5 text-sm text-white mb-4 focus:outline-none focus:border-[#6366f1] transition-colors">
              <option value="">Select user...</option>
              {users.filter(u=>u.role!=="admin").map(u=>(<option key={u.username} value={u.username}>{u.username}{u.sanction_type?` (${u.sanction_type})`:""}</option>))}
            </select>

            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                {v:"warned",l:"Warning",c:"#f59e0b"},
                {v:"suspended",l:"Suspension",c:"#f97316"},
                {v:"banned",l:"Permanent Ban",c:"#ef4444"},
                {v:"comment_restricted",l:"Comment Ban",c:"#8b5cf6"},
              ].map(t=>(
                <button key={t.v} onClick={()=>setSancType(t.v)}
                  className={`text-xs font-medium px-3 py-2.5 rounded-xl border transition-all ${
                    sancType===t.v ? "border-current text-white" : "border-[#1a1a2e] text-[#71717a] hover:border-[#2a2a45]"
                  }`}
                  style={sancType===t.v?{borderColor:t.c,background:t.c+"11"}:{}}
                >
                  {t.l}
                </button>
              ))}
            </div>

            {sancType==="suspended"&&(
              <div className="flex gap-2 mb-4">
                <input type="number" value={sancDurVal} onChange={e=>setSancDurVal(Math.max(1,parseInt(e.target.value)||1))} min={1}
                  className="w-20 bg-[#111118] border border-[#1a1a2e] rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-[#6366f1]" />
                <select value={sancDurUnit} onChange={e=>setSancDurUnit(e.target.value)}
                  className="bg-[#111118] border border-[#1a1a2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366f1]">
                  {DURATION_UNITS.map(u=>(<option key={u.value} value={u.value}>{u.label}</option>))}
                </select>
              </div>
            )}

            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Reason</label>
            <input type="text" value={sancReason} onChange={e=>setSancReason(e.target.value)}
              placeholder="e.g. Repeated spam in reviews"
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-xl px-4 py-2.5 text-sm text-white mb-4 focus:outline-none focus:border-[#6366f1] transition-colors" />

            <div className="flex gap-2">
              <button onClick={applySanction} disabled={!selUser||sancLoading}
                className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/20 disabled:opacity-30 transition-colors">
                {sancLoading?"Applying...":"Apply Sanction"}
              </button>
              <button onClick={removeSanction} disabled={!selUser||sancLoading}
                className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#22c55e]/20 disabled:opacity-30 transition-colors">
                Remove Sanction
              </button>
            </div>

            {sancMsg&&(
              <p className={`text-xs mt-3 ${sancMsg.startsWith("Sanction")||sancMsg.startsWith("Sanction removed")?"text-[#22c55e]":"text-[#ef4444]"}`}>
                {sancMsg}
              </p>
            )}
          </div>

          {/* Sanctioned users list */}
          <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1a1a2e] flex items-center justify-between">
              <span className="text-sm font-medium text-white">Sanctioned Users</span>
              <button onClick={loadUsers} className="text-xs text-[#71717a] hover:text-white transition-colors">Refresh</button>
            </div>
            {users.filter(u=>u.sanction_type).length===0?(
              <div className="px-5 py-8 text-center text-sm text-[#71717a]">No sanctioned users</div>
            ):(
              <div className="divide-y divide-[#1a1a2e]">
                {users.filter(u=>u.sanction_type).map(u=>(
                  <div key={u.username} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-white font-medium">{u.username}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        u.sanction_type==="banned"?"bg-[#ef4444]/15 text-[#ef4444]":
                        u.sanction_type==="suspended"?"bg-[#f97316]/15 text-[#f97316]":
                        u.sanction_type==="warned"?"bg-[#f59e0b]/15 text-[#f59e0b]":
                        "bg-[#8b5cf6]/15 text-[#8b5cf6]"
                      }`}>{u.sanction_type}</span>
                    </div>
                    <span className="text-xs text-[#52525b]">
                      {u.sanction_until ? `Until ${fmtDateTime(u.sanction_until)}` : "Permanent"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === AUDIT TAB === */}
      {tab==="audit"&&(
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#71717a]">{auditTotal} actions logged</p>
            <div className="flex items-center gap-2">
              <select value={auditFilter} onChange={e=>{setAuditFilter(e.target.value);setTimeout(()=>loadAudit(),50);}}
                className="bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-1.5 text-xs text-[#a1a1aa] focus:outline-none focus:border-[#6366f1]">
                <option value="">All Actions</option>
                <option value="sanction">Sanctions</option>
                <option value="unsanction">Unsanctions</option>
                <option value="hide_content">Hidden</option>
                <option value="restore_content">Restored</option>
                <option value="delete_content">Deleted</option>
                <option value="delete_user">User Deleted</option>
              </select>
              <button onClick={()=>loadAudit()}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#1a1a2e] text-[#71717a] hover:text-white hover:border-[#2a2a45] transition-colors">
                Refresh
              </button>
            </div>
          </div>

          {auditLoading?(
            <p className="text-sm text-[#71717a]">Loading...</p>
          ):audit.length===0?(
            <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-10 text-center">
              <p className="text-sm text-[#71717a]">No audit log entries yet</p>
            </div>
          ):(
            <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left py-3 px-4 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">When</th>
                    <th className="text-left py-3 px-4 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Admin</th>
                    <th className="text-left py-3 px-4 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Action</th>
                    <th className="text-left py-3 px-4 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Target</th>
                    <th className="text-left py-3 px-4 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((log,i)=>(
                    <tr key={log.id} className={`border-b border-[#1a1a2e]/50 ${i%2===0?"bg-[#0a0a14]/50":""}`}>
                      <td className="py-2.5 px-4 text-xs text-[#71717a]">{fmtDate(log.created_at)}</td>
                      <td className="py-2.5 px-4 text-sm text-white">{log.admin_username}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          log.action==="sanction"?"bg-[#ef4444]/10 text-[#ef4444]":
                          log.action==="unsanction"?"bg-[#22c55e]/10 text-[#22c55e]":
                          log.action==="hide_content"?"bg-[#f59e0b]/10 text-[#f59e0b]":
                          log.action==="restore_content"?"bg-[#22c55e]/10 text-[#22c55e]":
                          log.action==="delete_user"?"bg-[#ef4444]/10 text-[#ef4444]":
                          "bg-[#71717a]/10 text-[#a1a1aa]"
                        }`}>{log.action.replace(/_/g," ")}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[#a1a1aa]">{log.target_type}: {log.target_id}</td>
                      <td className="py-2.5 px-4 text-xs text-[#52525b] max-w-[200px] truncate">
                        {log.details?(log.details.reason||log.details.sanction_type||log.details.content_preview||JSON.stringify(log.details).substring(0,60)):"—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<div className="p-8"><p className="text-sm text-[#71717a]">Loading...</p></div>}>
      <AdminReportsContent />
    </Suspense>
  );
}
