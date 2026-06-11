"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.user) {
      // Store username in localStorage so RouletteCard + sidebar avatar work
      const username = data.user.user_metadata?.username;
      if (username) {
        localStorage.setItem("seriez-username", username);
      } else {
        // Fallback: lookup from users table
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=username&id=eq.${data.user.id}`,
            { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
          );
          const rows = await res.json();
          if (rows?.[0]?.username) {
            localStorage.setItem("seriez-username", rows[0].username);
          }
        } catch {}
      }
      router.push("/");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-20 pb-32">
      <h1 className="text-2xl font-bold text-white mb-2">Sign in</h1>
      <p className="text-sm text-[#9ca3af] mb-6">Save your watch data across devices</p>

      {sent ? (
        <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-5 text-center">
          <p className="text-white font-medium mb-1">Magic link sent!</p>
          <p className="text-sm text-[#9ca3af]">Check {email} for the sign-in link.</p>
        </div>
      ) : (
        <>
          <form onSubmit={handleMagicLink} className="mb-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 outline-none border border-[#2d2d4a] focus:border-[#6366f1] mb-3"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#6366f1] text-white font-semibold hover:bg-[#818cf8] transition-colors disabled:opacity-50"
            >
              Send magic link
            </button>
          </form>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#2d2d4a]" />
            <span className="text-xs text-[#6b7280]">or password</span>
            <div className="flex-1 h-px bg-[#2d2d4a]" />
          </div>

          <form onSubmit={handleEmailLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 outline-none border border-[#2d2d4a] focus:border-[#6366f1] mb-3"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 outline-none border border-[#2d2d4a] focus:border-[#6366f1] mb-1"
              required
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 mb-3"
            >
              Sign in
            </button>
          </form>

          <p className="text-center text-sm text-[#9ca3af]">
            No account?{" "}
            <a href="/signup" className="text-[#6366f1] hover:underline">
              Create one
            </a>
          </p>
        </>
      )}
    </div>
  );
}
