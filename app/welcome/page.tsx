"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const debounce = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  const checkUsername = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) { setStatus("idle"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setStatus("invalid"); return; }

    setStatus("checking");
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(trimmed)}`);
      const { available } = await res.json();
      setStatus(available ? "available" : "taken");
    } catch {
      setStatus("idle"); // network error, don't block
    }
  }, []);

  function handleChange(value: string) {
    setName(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => checkUsername(value), 300);
  }

  function randomName() {
    return "user-" + Math.random().toString(36).slice(2, 10);
  }

  async function submit(username: string) {
    if (!user || status === "taken" || status === "invalid") return;
    setLoading(true);

    const trimmed = username.trim();
    const { error: dbError } = await supabase.from("users").upsert({
      id: user.id,
      username: trimmed,
      email: user.email ?? `${trimmed}@seriezuser.com`,
    }, { onConflict: "id" });

    if (dbError) {
      setLoading(false);
      return;
    }

    localStorage.setItem("seriez-username", trimmed);
    document.cookie = `seriez-username=${trimmed};path=/;max-age=31536000;SameSite=Lax`;
    router.push("/");
    router.refresh();
  }

  async function handleSkip() {
    await submit(randomName());
  }

  if (!user) return null;

  const borderColor =
    status === "available" ? "border-green-500" :
    status === "taken" || status === "invalid" ? "border-red-400" :
    "border-border focus:border-accent";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#a855f7]">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-1">Welcome to Seriez</h1>
        <p className="text-sm text-text-secondary mb-6">Choose a username to get started</p>

        <form onSubmit={(e) => { e.preventDefault(); submit(name); }} className="space-y-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-sm">@</span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="username"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className={`w-full bg-bg-card text-text-primary rounded-xl pl-8 pr-10 py-3 outline-none border ${borderColor} transition-colors`}
            />
            {status === "checking" && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
            )}
            {status === "available" && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>
            )}
            {status === "taken" && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 text-sm">✕</span>
            )}
          </div>

          {status === "taken" && <p className="text-red-400 text-xs">Username is already taken</p>}
          {status === "invalid" && <p className="text-red-400 text-xs">Letters, numbers, and underscores only</p>}

          <button
            type="submit"
            disabled={loading || !name.trim() || status === "taken" || status === "invalid" || status === "checking"}
            className="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:bg-[#818cf8] transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>

        <button
          onClick={handleSkip}
          className="mt-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
