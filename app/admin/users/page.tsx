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
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-text-primary">Users</h1>
          <Link href="/admin" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            ← Dashboard
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-bg-card border border-border rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
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
          <div className="text-text-secondary text-sm">Loading...</div>
        ) : (
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Username</th>
                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Premium</th>
                    <th className="text-left px-4 py-3 text-text-secondary font-medium hidden sm:table-cell">Joined</th>
                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-text-secondary font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.username} className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${u.username}`} className="text-accent hover:underline font-medium">
                          {u.username}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          u.role === "admin" ? "bg-red-500/10 text-red-400" :
                          u.role === "moderator" ? "bg-blue-500/10 text-blue-400" :
                          "bg-bg-surface text-text-secondary"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_premium ? (
                          <span className="text-xs text-gold">★ Gold</span>
                        ) : (
                          <span className="text-xs text-text-secondary">Free</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {u.sanction_type ? (
                          <span className="text-xs text-red-400">Sanctioned</span>
                        ) : (
                          <span className="text-xs text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.role !== "admin" && (
                          <button
                            onClick={() => { setDeleteTarget(u.username); setDeleteConfirm(""); setDeleteError(""); }}
                            className="text-text-secondary hover:text-red-400 transition-colors p-1"
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
              <div className="px-4 py-8 text-center text-text-secondary text-sm">
                No users found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Delete User</h2>
            <p className="text-sm text-text-secondary mb-4">
              This will permanently delete <span className="text-red-400 font-medium">@{deleteTarget}</span> and all their data. Type the username to confirm.
            </p>
            <input
              type="text"
              placeholder={deleteTarget}
              value={deleteConfirm}
              onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(""); }}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent mb-3"
            />
            {deleteError && <p className="text-xs text-red-400 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); setDeleteError(""); }}
                className="flex-1 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-surface rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== deleteTarget}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl transition-colors"
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
