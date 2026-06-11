"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function ChangeProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [bgScale, setBgScale] = useState(100);
  const [bgPositionX, setBgPositionX] = useState(50);
  const [bgPositionY, setBgPositionY] = useState(50);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);
  const [showAvatarActions, setShowAvatarActions] = useState(false);
  const [showBgActions, setShowBgActions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const username = user?.user_metadata?.username;
  const displayName = username || "Guest";
  const initial = displayName.slice(0, 1).toUpperCase();

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`).then(r => r.json());
      setAvatarUrl(res.avatar_url || null);
      setBackgroundUrl(res.background_url || null);
      setBgScale(res.background_scale ?? 100);
      setBgPositionX(res.background_position_x ?? 50);
      setBgPositionY(res.background_position_y ?? 50);
    } catch {}
  }, [username]);

  const fetchCounts = useCallback(async () => {
    if (!username) return;
    try {
      const [fr, fg] = await Promise.all([
        fetch(`/api/follow?username=${encodeURIComponent(username)}&type=followers`).then(r => r.json()),
        fetch(`/api/follow?username=${encodeURIComponent(username)}&type=following`).then(r => r.json()),
      ]);
      setFollowersCount(fr.count || 0);
      setFollowingCount(fg.count || 0);
    } catch {}
  }, [username]);

  useEffect(() => { if (username) { fetchProfile(); fetchCounts(); } }, [fetchProfile, fetchCounts, username]);

  async function handleAvatarUpload(file: File) {
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData }).then(r => r.json());
      if (res.error) { alert(res.error); return; }
      setAvatarUrl(res.avatarUrl);
      setShowAvatarActions(false);
    } catch { alert("Upload failed"); }
    finally { setAvatarUploading(false); }
  }

  async function handleAvatarDelete() {
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" }).then(r => r.json());
      if (res.error) return;
      setAvatarUrl(null);
      setShowAvatarActions(false);
    } catch {}
  }

  async function handleBackgroundUpload(file: File) {
    if (!file) return;
    setBgUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "background");
      const res = await fetch("/api/profile/background", { method: "POST", body: formData }).then(r => r.json());
      if (res.error) { alert(res.error); return; }
      setBackgroundUrl(res.backgroundUrl);
      setShowBgActions(false);
    } catch { alert("Upload failed"); }
    finally { setBgUploading(false); }
  }

  async function handleBackgroundDelete() {
    try {
      await fetch("/api/profile/background", { method: "DELETE" });
      setBackgroundUrl(null);
      setShowBgActions(false);
    } catch {}
  }

  async function handleSaveBgSettings() {
    setBgSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background_scale: bgScale, background_position_x: bgPositionX, background_position_y: bgPositionY }),
      });
    } catch {}
    setBgSaving(false);
  }

  return (
    <ErrorBoundary sectionName="Change Profile">
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="text-[#9ca3af] hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-white">Change Profile</h1>
        </div>

        {/* ── Cover area (matches profile page exactly) ── */}
        <div className="relative">
          <button
            onClick={() => setShowBgActions(!showBgActions)}
            className={`relative w-full h-40 block transition-all active:scale-[0.99] cursor-pointer ${
              !backgroundUrl ? "bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#a855f7]" : ""
            }`}
            style={backgroundUrl ? {
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: `${bgScale}%`,
              backgroundPosition: `${bgPositionX}% ${bgPositionY}%`,
              backgroundRepeat: "no-repeat",
            } : undefined}
          >
            {!backgroundUrl && (
              <div className="absolute inset-0 overflow-hidden opacity-20">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white" />
                <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white" />
              </div>
            )}
            {bgUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </button>

          {/* ── Avatar + Info row (matches profile page) ── */}
          <div className="relative px-4 -mt-10">
            <div className="flex items-end gap-4 mb-2">
              <button
                onClick={() => setShowAvatarActions(!showAvatarActions)}
                className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden ring-4 ring-[#0f0f1a] shadow-xl transition-all active:scale-95 flex-shrink-0 ${
                  !avatarUrl ? "bg-gradient-to-br from-[#6366f1] to-[#a855f7]" : ""
                }`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white">{initial}</span>
                )}
              </button>
              <div className="flex-1" />
            </div>

            {/* Username + settings */}
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-white">@{displayName}</h2>
            </div>
            <div className="flex gap-5 text-sm text-[#9ca3af]">
              <span><strong className="text-white">{followersCount}</strong> followers</span>
              <span><strong className="text-white">{followingCount}</strong> following</span>
            </div>
          </div>
        </div>

        {/* ── Hidden file inputs ── */}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
        <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBackgroundUpload(f); }} />

        {/* ── Action buttons (appear on tap) ── */}
        <div className="px-4 mt-4 space-y-4">
          {/* Avatar actions */}
          <div className={`flex justify-center gap-3 transition-all duration-200 ${
            showAvatarActions ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none absolute"
          }`}>
            <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}
              className="px-5 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {avatarUploading ? "Uploading..." : avatarUrl ? "Change Photo" : "Add Photo"}
            </button>
            {avatarUrl && (
              <button onClick={handleAvatarDelete}
                className="px-5 py-2 bg-[#1a1a2e] border border-[#2d2d4a] hover:border-red-500/50 hover:text-red-400 text-[#9ca3af] text-sm font-medium rounded-lg transition-colors">
                Delete
              </button>
            )}
          </div>

          {/* Background actions */}
          <div className={`flex justify-center gap-3 transition-all duration-200 ${
            showBgActions ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none absolute"
          }`}>
            <button onClick={() => bgInputRef.current?.click()} disabled={bgUploading}
              className="px-5 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {bgUploading ? "Uploading..." : backgroundUrl ? "Change Image" : "Add Image"}
            </button>
            {backgroundUrl && (
              <button onClick={handleBackgroundDelete}
                className="px-5 py-2 bg-[#1a1a2e] border border-[#2d2d4a] hover:border-red-500/50 hover:text-red-400 text-[#9ca3af] text-sm font-medium rounded-lg transition-colors">
                Delete
              </button>
            )}
          </div>
        </div>

        {/* ── Background zoom/position controls ── */}
        {backgroundUrl && (
          <div className="px-4 mt-6">
            <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#9ca3af]">Zoom</span>
                  <span className="text-xs text-[#6366f1] font-medium">{bgScale}%</span>
                </div>
                <input type="range" min="50" max="200" value={bgScale}
                  onChange={(e) => setBgScale(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#2d2d4a] rounded-full appearance-none cursor-pointer accent-[#6366f1]" />
                <div className="flex justify-between mt-1">
                  {[50, 100, 150, 200].map(v => (
                    <button key={v} onClick={() => setBgScale(v)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${bgScale === v ? "bg-[#6366f1]/20 text-[#818cf8]" : "text-[#6b7280] hover:text-white"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-[#9ca3af] block mb-2">Position</span>
                <div className="grid grid-cols-3 gap-1.5 w-28 mx-auto">
                  {[
                    { x: 0, y: 0, label: "↖" }, { x: 50, y: 0, label: "↑" }, { x: 100, y: 0, label: "↗" },
                    { x: 0, y: 50, label: "←" }, { x: 50, y: 50, label: "⊙" }, { x: 100, y: 50, label: "→" },
                    { x: 0, y: 100, label: "↙" }, { x: 50, y: 100, label: "↓" }, { x: 100, y: 100, label: "↘" },
                  ].map(p => (
                    <button key={`${p.x}-${p.y}`}
                      onClick={() => { setBgPositionX(p.x); setBgPositionY(p.y); }}
                      className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all ${
                        bgPositionX === p.x && bgPositionY === p.y
                          ? "bg-[#6366f1] text-white shadow-sm"
                          : "bg-[#2d2d4a] text-[#9ca3af] hover:bg-[#3d3d5a] hover:text-white"
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveBgSettings} disabled={bgSaving}
                className="w-full py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {bgSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
