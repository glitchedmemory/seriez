"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTheme, type ThemeMode } from "@/lib/theme";

const PW_RULES = {
  minLength: 8,
  label: "8+ chars, upper/lower/special",
};

function validatePassword(pw: string): string | null {
  if (pw.length < PW_RULES.minLength) return `Password must be at least ${PW_RULES.minLength} characters`;
  if (!/[A-Z]/.test(pw)) return "Password must include at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must include at least one lowercase letter";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw)) return "Password must include at least one special character";
  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Reset ratings
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Logout
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleChangePassword() {
    if (!currentPw || !newPw) {
      setPwMsg({ ok: false, text: "Please fill in all fields" });
      return;
    }
    const pwError = validatePassword(newPw);
    if (pwError) {
      setPwMsg({ ok: false, text: pwError });
      return;
    }
    if (currentPw === newPw) {
      setPwMsg({ ok: false, text: "New password must differ from current" });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      }).then(r => r.json());
      if (res.error) {
        setPwMsg({ ok: false, text: res.error });
      } else {
        setPwMsg({ ok: true, text: "Password changed successfully" });
        setCurrentPw("");
        setNewPw("");
        setShowPwForm(false);
      }
    } catch {
      setPwMsg({ ok: false, text: "Something went wrong" });
    }
    setPwLoading(false);
  }

  async function handleResetRatings() {
    setResetLoading(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/auth/reset-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: resetInput }),
      }).then(r => r.json());
      if (res.error) {
        setResetMsg(res.error);
      } else {
        setResetMsg("Ratings and reviews have been reset");
        setShowResetConfirm(false);
        setResetInput("");
      }
    } catch {
      setResetMsg("Something went wrong");
    }
    setResetLoading(false);
  }

  async function handleDeleteAccount() {
    if (!deletePw || !deleteInput) {
      setDeleteMsg("Please fill in all fields");
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg("");
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw, confirmation: deleteInput }),
      }).then(r => r.json());
      if (res.error) {
        setDeleteMsg(res.error);
      } else {
        await supabase.auth.signOut();
        localStorage.removeItem("seriez-username");
        router.push("/");
      }
    } catch {
      setDeleteMsg("Something went wrong");
    }
    setDeleteLoading(false);
  }

  async function handleLogout() {
    setLogoutLoading(true);
    await supabase.auth.signOut();
    localStorage.removeItem("seriez-username");
    router.push("/");
  }

  return (
    <ErrorBoundary sectionName="Settings">
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 pt-6 pb-4">
          <button
            onClick={() => router.back()}
            className="text-text-secondary hover:text-white light:hover:text-accent transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        </div>

        <div className="px-4 space-y-3 mt-1">
          {/* ── Profile ── */}
          <button
            onClick={() => router.push("/profile/settings/change-profile")}
            className="w-full flex items-center justify-between bg-bg-card border border-border rounded-xl px-4 py-3.5 hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">👤</span>
              <span className="text-sm text-text-primary">Change Profile</span>
            </div>
            <span className="text-xs text-[#4b5563] group-hover:text-text-secondary transition-colors">
              Avatar · Background →
            </span>
          </button>

          {/* ── Appearance ── */}
          <div className="bg-bg-card border border-border rounded-xl px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-lg">🎨</span>
              <span className="text-sm text-text-primary">Appearance</span>
            </div>
            <div className="flex gap-2">
              {(["system", "dark", "light"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                    theme === mode
                      ? "bg-accent text-white shadow-lg shadow-accent/30"
                      : "bg-bg-primary text-text-secondary border border-border hover:border-accent/40"
                  }`}
                >
                  {mode === "system" ? "🌓 System" : mode === "dark" ? "🌙 Dark" : "☀️ Light"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Email ── */}
          <div className="bg-bg-card border border-border rounded-xl px-4 py-3.5 opacity-50">
            <div className="flex items-center gap-3">
              <span className="text-lg">✉️</span>
              <div>
                <span className="text-sm text-text-primary">Change Email</span>
                <p className="text-[10px] text-gold">SMTP setup required</p>
              </div>
            </div>
          </div>

          {/* ── Password ── */}
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPwForm(!showPwForm)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔒</span>
                <span className="text-sm text-text-primary">Change Password</span>
              </div>
              <span className="text-text-secondary text-xs transition-transform duration-200" style={{ transform: showPwForm ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▼
              </span>
            </button>
            {showPwForm && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                <div>
                  <label className="text-[11px] text-text-secondary block mb-1.5">Current password</label>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-secondary block mb-1.5">New password</label>
                  <input
                    type="password"
                    placeholder={PW_RULES.label}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-text-secondary mt-1">{PW_RULES.label}</p>
                </div>
                {pwMsg && (
                  <p className={`text-xs ${pwMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{pwMsg.text}</p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={pwLoading}
                  className="w-full py-2.5 bg-accent hover:bg-accent-light disabled:opacity-50 text-text-primary text-sm font-medium rounded-lg transition-colors"
                >
                  {pwLoading ? "Changing..." : "Change Password"}
                </button>
              </div>
            )}
          </div>

          {/* ── Log Out ── */}
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 py-3.5 hover:border-red-500/40 transition-colors"
          >
            <span className="text-lg">🚪</span>
            <span className="text-sm text-red-400">{logoutLoading ? "Logging out..." : "Log Out"}</span>
          </button>

          {/* ── Reset Ratings ── */}
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowResetConfirm(!showResetConfirm)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔄</span>
                <span className="text-sm text-gold">Reset Ratings & Reviews</span>
              </div>
              <span className="text-text-secondary text-xs transition-transform duration-200" style={{ transform: showResetConfirm ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▼
              </span>
            </button>
            {showResetConfirm && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                <p className="text-xs text-text-secondary leading-relaxed">
                  This will permanently delete all your ratings and reviews. Type your username to confirm.
                </p>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-gold"
                />
                {resetMsg && (
                  <p className={`text-xs ${resetMsg.includes("have been") ? "text-emerald-400" : "text-red-400"}`}>{resetMsg}</p>
                )}
                <button
                  onClick={handleResetRatings}
                  disabled={resetLoading || !resetInput}
                  className="w-full py-2.5 bg-gold hover:bg-gold disabled:opacity-50 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  {resetLoading ? "Resetting..." : "Reset All Ratings"}
                </button>
              </div>
            )}
          </div>

          {/* ── Delete Account ── */}
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🗑️</span>
                <span className="text-sm text-red-400">Delete Account</span>
              </div>
              <span className="text-text-secondary text-xs transition-transform duration-200" style={{ transform: showDeleteConfirm ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▼
              </span>
            </button>
            {showDeleteConfirm && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Your account and all data will be permanently deleted. This cannot be undone.
                </p>
                <div>
                  <label className="text-[11px] text-text-secondary block mb-1.5">Password</label>
                  <input
                    type="password"
                    value={deletePw}
                    onChange={(e) => setDeletePw(e.target.value)}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-secondary block mb-1.5">Username</label>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-red-500"
                  />
                </div>
                {deleteMsg && (
                  <p className="text-xs text-red-400">{deleteMsg}</p>
                )}
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || !deletePw || !deleteInput}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-text-primary text-sm font-medium rounded-lg transition-colors"
                >
                  {deleteLoading ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
