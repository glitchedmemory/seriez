"use client";

import { useState, useEffect, useCallback } from "react";

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

export default function AuditPage() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");

  const load = useCallback(async (offset=0) => {
    setAuditLoading(true);
    try {
      const p = new URLSearchParams({limit:"50",offset:String(offset)});
      if (auditFilter) p.set("action",auditFilter);
      const r = await fetch("/api/admin/audit-log?"+p.toString());
      if (r.ok) { const d = await r.json(); setAudit(d.actions||[]); setAuditTotal(d.total||0); }
    } catch {}
    setAuditLoading(false);
  }, [auditFilter]);

  useEffect(()=>{load();},[load]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Audit Log</h1>
      <p className="text-sm text-[#71717a] mb-6">Track all admin actions and moderation history</p>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#71717a]">{auditTotal} actions logged</p>
        <div className="flex items-center gap-2">
          <select value={auditFilter} onChange={e=>{setAuditFilter(e.target.value);setTimeout(()=>load(),50);}}
            className="bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-1.5 text-xs text-[#a1a1aa] focus:outline-none focus:border-[#6366f1]">
            <option value="">All Actions</option>
            <option value="sanction">Sanctions</option>
            <option value="unsanction">Unsanctions</option>
            <option value="hide_content">Hidden</option>
            <option value="restore_content">Restored</option>
            <option value="delete_content">Deleted</option>
            <option value="delete_user">User Deleted</option>
          </select>
          <button onClick={()=>load()}
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
  );
}
