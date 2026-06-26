"use client";

import { useState, useEffect, useCallback } from "react";

interface UserInfo {
  username: string;
  role: string;
  sanction_type?: string | null;
  sanction_until?: string | null;
}

const DURATION_UNITS = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function SanctionsPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selUser, setSelUser] = useState("");
  const [sancType, setSancType] = useState("warned");
  const [sancReason, setSancReason] = useState("");
  const [sancDurVal, setSancDurVal] = useState(1);
  const [sancDurUnit, setSancDurUnit] = useState("days");
  const [sancLoading, setSancLoading] = useState(false);
  const [sancMsg, setSancMsg] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/users");
      if (r.ok) { const d = await r.json(); setUsers(d.users||[]); }
    } catch {}
  }, []);

  useEffect(()=>{loadUsers();},[loadUsers]);

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
      if (r.ok) { setSancMsg("Sanction applied"); setSelUser(""); setSancReason(""); loadUsers(); }
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
      if (r.ok) { setSancMsg("Sanction removed"); setSelUser(""); loadUsers(); }
      else setSancMsg(d.error);
    } catch { setSancMsg("Failed"); }
    setSancLoading(false);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Sanctions</h1>
      <p className="text-sm text-[#71717a] mb-6">Manage user sanctions and restrictions</p>

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
                style={sancType===t.v?{borderColor:t.c,background:t.c+"11"}:{}}>
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
            placeholder="Reason for sanction"
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
            <p className={`text-xs mt-3 ${sancMsg.startsWith("Sanction")?"text-[#22c55e]":"text-[#ef4444]"}`}>{sancMsg}</p>
          )}
        </div>

        {/* Sanctioned users */}
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
    </div>
  );
}
