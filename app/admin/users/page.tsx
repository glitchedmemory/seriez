"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface User {
  username: string;
  role: string;
  is_premium: boolean;
  created_at: string;
  sanction_type?: string | null;
  sanction_until?: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "premium" | "free" | "admin" | "moderator" | "sanctioned">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  function loadUsers() {
    setLoading(true);
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(data => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteConfirm !== deleteTarget) {
      setDeleteError("Type the username to confirm");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: deleteTarget }),
      }).then(r => r.json());
      if (res.error) {
        setDeleteError(res.error);
      } else {
        setDeleteTarget(null);
        setDeleteConfirm("");
        loadUsers();
      }
    } catch {
      setDeleteError("Something went wrong");
    }
    setDeleting(false);
  }

  const filtered = users.filter(u => {
    if (search && !u.username.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "premium" && !u.is_premium) return false;
    if (filter === "free" && u.is_premium) return false;
    if (filter === "admin" && u.role !== "admin") return false;
    if (filter === "moderator" && u.role !== "moderator") return false;
    if (filter === "sanctioned" && !u.sanction_type) return false;
    return true;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
            <p className="text-sm text-[#71717a] mt-1">{users.length} users</p>
          </div>
          <button
            onClick={loadUsers}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#1a1a2e] text-[#71717a] hover:text-white hover:border-[#2a2a45] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-[#0a0a14] border border-[#1a1a2e] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#52525b] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="bg-[#0a0a14] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-sm text-[#a1a1aa] focus:outline-none focus:border-[#6366f1] transition-colors"
          >
            <option value="all">All Users</option>
            <option value="premium">Premium</option>
            <option value="free">Free</option>
            <option value="admin">Admins</option>
            <option value="moderator">Moderators</option>
            <option value="sanctioned">Sanctioned</option>
          </select>
        </div>

        {loading ? (
          <div className="text-sm text-[#71717a]">Loading...</div>
        ) : (
          <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Username</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Premium</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider hidden sm:table-cell">Joined</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.username} className="border-b border-[#1a1a2e]/50 hover:bg-[#111118]/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${u.username}`} className="text-[#6366f1] hover:underline font-medium text-sm">
                          {u.username}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          u.role === "admin" ? "bg-[#ef4444]/10 text-[#ef4444]" :
                          u.role === "moderator" ? "bg-[#3b82f6]/10 text-[#3b82f6]" :
                          "bg-[#1a1a2e] text-[#a1a1aa]"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_premium ? (
                          <span className="text-[11px] text-[#f59e0b] font-medium">Gold</span>
                        ) : (
                          <span className="text-[11px] text-[#52525b]">Free</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#71717a] hidden sm:table-cell">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {u.sanction_type ? (
                          <span className="text-[11px] text-[#ef4444]">Sanctioned</span>
                        ) : (
                          <span className="text-[11px] text-[#52525b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.role !== "admin" && (
                          <button
                            onClick={() => { setDeleteTarget(u.username); setDeleteConfirm(""); setDeleteError(""); }}
                            className="text-[#52525b] hover:text-[#ef4444] transition-colors p-1"
                            title="Delete user"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-[#71717a]">
                No users found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0a0a14] border border-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-white mb-2">Delete User</h2>
            <p className="text-sm text-[#71717a] mb-4">
              Permanently delete <span className="text-[#ef4444] font-medium">@{deleteTarget}</span> and all their data. Type the username to confirm.
            </p>
            <input
              type="text"
              placeholder={deleteTarget}
              value={deleteConfirm}
              onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(""); }}
              className="w-full bg-[#111118] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#52525b] focus:outline-none focus:border-[#ef4444] transition-colors mb-3"
            />
            {deleteError && <p className="text-xs text-[#ef4444] mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); setDeleteError(""); }}
                className="flex-1 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white bg-[#111118] rounded-xl transition-colors border border-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== deleteTarget}
                className="flex-1 py-2 text-sm font-medium text-white bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 rounded-xl transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
