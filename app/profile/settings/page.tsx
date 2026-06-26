"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTheme, type ThemeMode } from "@/lib/theme";

// ─── Inline SVG icons to replace emojis ───
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IconPalette = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1.5" fill="currentColor"/><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2 2 0 0 0 2-2c0-.52-.2-1.01-.55-1.38-.36-.38-.54-.87-.54-1.38 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.51-4.49-10-10-10z"/>
  </svg>
);
const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
  </svg>
);
const IconTrash = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

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

// ─── Shared input style ───
const inputClass = "w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all";

export default function SettingsPage() {
  const t_ = useTranslations();
  const locale = useLocale();
  const [language, setLanguage] = useState(locale);
  const [changing, setChanging] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showAppearance, setShowAppearance] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleChangePassword() {
    if (!currentPw || !newPw) { setPwMsg({ ok: false, text: "Please fill in all fields" }); return; }
    const pwError = validatePassword(newPw);
    if (pwError) { setPwMsg({ ok: false, text: pwError }); return; }
    if (currentPw === newPw) { setPwMsg({ ok: false, text: "New password must differ from current" }); return; }
    setPwLoading(true); setPwMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) }).then(r => r.json());
      if (res.error) { setPwMsg({ ok: false, text: res.error }); }
      else {
        // Supabase invalidates all sessions on password change — force re-login
        await supabase.auth.signOut();
        localStorage.removeItem("seriez-username");
        router.push("/login?pw_changed=1");
      }
    } catch { setPwMsg({ ok: false, text: "Something went wrong" }); }
    setPwLoading(false);
  }

  async function handleResetRatings() {
    setResetLoading(true); setResetMsg("");
    try {
      const res = await fetch("/api/auth/reset-ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: resetInput }) }).then(r => r.json());
      if (res.error) { setResetMsg(res.error); }
      else { setResetMsg("Ratings and reviews have been reset"); setShowResetConfirm(false); setResetInput(""); }
    } catch { setResetMsg("Something went wrong"); }
    setResetLoading(false);
  }

  async function handleDeleteAccount() {
    if (!deletePw || !deleteInput) { setDeleteMsg("Please fill in all fields"); return; }
    setDeleteLoading(true); setDeleteMsg("");
    try {
      const res = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePw, confirmation: deleteInput }) }).then(r => r.json());
      if (res.error) { setDeleteMsg(res.error); }
      else { await supabase.auth.signOut(); localStorage.removeItem("seriez-username"); router.push("/"); }
    } catch { setDeleteMsg("Something went wrong"); }
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
      <div className="w-[896px] max-w-full mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-8 pb-6">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">Settings</h1>
            <p className="text-xs text-text-secondary mt-0.5">Manage your account and preferences</p>
          </div>
        </div>

        <div className="px-6 space-y-8">
          {/* ─── SECTION: Personalization ─── */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60 mb-3 ml-1">Personalization</h2>
            <div className="bg-bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {/* Change Profile */}
              <button
                onClick={() => router.push("/profile/settings/change-profile")}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-surface transition-colors group"
              >
                <span className="text-accent"><IconUser /></span>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-text-primary">Profile</span>
                  <p className="text-[11px] text-text-secondary mt-0.5">Avatar, background, and display name</p>
                </div>
                <span className="text-text-secondary/30 group-hover:text-text-secondary transition-colors"><IconChevronRight /></span>
              </button>

              {/* Language */}
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="text-accent/80"><IconGlobe /></span>
                <div className="flex-1">
                  <span className="text-sm font-medium text-text-primary">{t_("profile.language")}</span>
                </div>
                <select
                  value={language}
                  onChange={async (e) => { const lang = e.target.value; setLanguage(lang); setChanging(true); try { await fetch("/api/users/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: lang }) }); window.location.reload(); } catch { setChanging(false); } }}
                  disabled={changing}
                  className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                >
                  <option value="en">English</option>
                  <option value="ko">한국어</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                </select>
              </div>

              {/* Appearance */}
              <div>
                <button
                  onClick={() => setShowAppearance(!showAppearance)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-surface transition-colors"
                >
                  <span className="text-accent/80"><IconPalette /></span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-text-primary">Appearance</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">{theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}</p>
                  </div>
                  <span className={`text-text-secondary transition-transform duration-200 ${showAppearance ? "rotate-180" : ""}`}><IconChevronDown /></span>
                </button>
                {showAppearance && (
                  <div className="px-5 pb-4 border-t border-border/40 pt-4">
                    <div className="flex gap-1.5 bg-bg-primary rounded-xl p-1 border border-border/50">
                      {(["system", "dark", "light"] as ThemeMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setTheme(mode)}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                            theme === mode
                              ? "bg-accent text-white shadow-sm shadow-accent/25"
                              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                          }`}
                        >
                          {mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ─── SECTION: Account ─── */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60 mb-3 ml-1">Account</h2>
            <div className="bg-bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {/* Email */}
              <div className="flex items-center gap-4 px-5 py-4 opacity-40">
                <span className="text-text-secondary"><IconMail /></span>
                <div className="flex-1">
                  <span className="text-sm font-medium text-text-primary">Change Email</span>
                  <p className="text-[11px] text-text-secondary mt-0.5">Coming soon</p>
                </div>
              </div>

              {/* Password */}
              <div>
                <button
                  onClick={() => setShowPwForm(!showPwForm)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-surface transition-colors"
                >
                  <span className="text-accent/80"><IconLock /></span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-text-primary">Change Password</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">Last changed recently</p>
                  </div>
                  <span className={`text-text-secondary transition-transform duration-200 ${showPwForm ? "rotate-180" : ""}`}><IconChevronDown /></span>
                </button>
                {showPwForm && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1.5">Current password</label>
                      <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1.5">New password</label>
                      <input type="password" placeholder={PW_RULES.label} value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputClass} />
                      <p className="text-[10px] text-text-secondary/60 mt-1">{PW_RULES.label}</p>
                    </div>
                    {pwMsg && <p className={`text-xs ${pwMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{pwMsg.text}</p>}
                    <button onClick={handleChangePassword} disabled={pwLoading}
                      className="w-full py-2.5 bg-accent hover:bg-accent-light disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-all duration-200">
                      {pwLoading ? "Changing..." : "Change Password"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ─── SECTION: Danger Zone ─── */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-400/60 mb-3 ml-1">Danger Zone</h2>
            <div className="bg-red-500/5 rounded-2xl border border-red-500/15 overflow-hidden divide-y divide-red-500/10">
              {/* Log Out */}
              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-500/10 transition-colors"
              >
                <span className="text-red-400"><IconLogout /></span>
                <span className="text-sm font-medium text-red-400">{logoutLoading ? "Logging out..." : "Log Out"}</span>
              </button>

              {/* Reset Ratings */}
              <div>
                <button
                  onClick={() => setShowResetConfirm(!showResetConfirm)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-500/10 transition-colors"
                >
                  <span className="text-amber-400"><IconRefresh /></span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-text-primary">Reset Ratings & Reviews</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">Permanently remove all your ratings and reviews</p>
                  </div>
                  <span className={`text-text-secondary transition-transform duration-200 ${showResetConfirm ? "rotate-180" : ""}`}><IconChevronDown /></span>
                </button>
                {showResetConfirm && (
                  <div className="px-5 pb-5 space-y-4 border-t border-red-500/10 pt-4">
                    <p className="text-xs text-text-secondary leading-relaxed">This will permanently delete all your ratings and reviews. Type your username to confirm.</p>
                    <input type="text" placeholder="Enter username" value={resetInput} onChange={(e) => setResetInput(e.target.value)} className={inputClass} />
                    {resetMsg && <p className={`text-xs ${resetMsg.includes("have been") ? "text-emerald-400" : "text-red-400"}`}>{resetMsg}</p>}
                    <button onClick={handleResetRatings} disabled={resetLoading || !resetInput}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-all duration-200">
                      {resetLoading ? "Resetting..." : "Reset All Ratings"}
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Account */}
              <div>
                <button
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-500/10 transition-colors"
                >
                  <span className="text-red-400"><IconTrash /></span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-red-400">Delete Account</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">Your data will be permanently erased</p>
                  </div>
                  <span className={`text-text-secondary transition-transform duration-200 ${showDeleteConfirm ? "rotate-180" : ""}`}><IconChevronDown /></span>
                </button>
                {showDeleteConfirm && (
                  <div className="px-5 pb-5 space-y-4 border-t border-red-500/10 pt-4">
                    <p className="text-xs text-text-secondary leading-relaxed">Your account and all data will be permanently deleted. This cannot be undone.</p>
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1.5">Password</label>
                      <input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1.5">Username</label>
                      <input type="text" placeholder="Enter your username" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} className={inputClass} />
                    </div>
                    {deleteMsg && <p className="text-xs text-red-400">{deleteMsg}</p>}
                    <button onClick={handleDeleteAccount} disabled={deleteLoading || !deletePw || !deleteInput}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-all duration-200">
                      {deleteLoading ? "Deleting..." : "Delete Account"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}
