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
    } catch { alert("Upload failed"); }
    finally { setAvatarUploading(false); }
  }

  async function handleAvatarDelete() {
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" }).then(r => r.json());
      if (res.error) return;
      setAvatarUrl(null);
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
    } catch { alert("Upload failed"); }
    finally { setBgUploading(false); }
  }

  async function handleBackgroundDelete() {
    try {
      await fetch("/api/profile/background", { method: "DELETE" });
      setBackgroundUrl(null);
    } catch {}
  }

  return (
    <ErrorBoundary sectionName="Change Profile">
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="text-text-secondary hover:text-white light:hover:text-accent transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-text-primary">Change Profile</h1>
        </div>

        {/* ── Cover area ── */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); bgInputRef.current?.click(); }}
            className={`relative w-full h-40 block cursor-pointer active:scale-[0.99] transition-transform ${
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
          {backgroundUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); handleBackgroundDelete(); }}
              className="absolute top-2 right-2 w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
            >
              <svg className="w-3.5 h-3.5 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}

          {/* ── Avatar (overlaps cover) ── */}
          <div className="relative px-4 -mt-10">
            <div className="flex items-end gap-4 mb-2">
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center ring-4 ring-[#0f0f1a] shadow-xl flex-shrink-0 transition-transform active:scale-95 ${
                    !avatarUrl ? "bg-gradient-to-br from-[#6366f1] to-[#a855f7]" : ""
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-3xl font-bold text-text-primary">{initial}</span>
                  )}
                </button>
                {avatarUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAvatarDelete(); }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
                  >
                    <svg className="w-3 h-3 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
              <div className="flex-1" />
            </div>

            {/* Username + stats */}
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-text-primary">@{displayName}</h2>
            </div>
            <div className="flex gap-5 text-sm text-text-secondary">
              <span><strong className="text-text-primary">{followersCount}</strong> followers</span>
              <span><strong className="text-text-primary">{followingCount}</strong> following</span>
            </div>
          </div>
        </div>

        {/* ── Hidden file inputs ── */}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
        <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBackgroundUpload(f); }} />
      </div>
    </ErrorBoundary>
  );
}
