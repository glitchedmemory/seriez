"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const t = useTranslations();
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
      <h1 className="text-2xl font-bold text-text-primary mb-2">{t("auth.signIn")}</h1>
      <p className="text-sm text-text-secondary mb-6">Save your watch data across devices</p>

      {sent ? (
        <div className="bg-bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-text-primary font-medium mb-1">Magic link sent!</p>
          <p className="text-sm text-text-secondary">Check {email} for the sign-in link.</p>
        </div>
      ) : (
        <>
          <form onSubmit={handleMagicLink} className="mb-4">
            <input
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-card text-text-primary rounded-xl px-4 py-3 outline-none border border-border focus:border-accent mb-3"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:bg-[#818cf8] transition-colors disabled:opacity-50"
            >
              Send magic link
            </button>
          </form>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#2d2d4a]" />
            <span className="text-xs text-text-secondary">or password</span>
            <div className="flex-1 h-px bg-[#2d2d4a]" />
          </div>

          <form onSubmit={handleEmailLogin}>
            <input
              type="email"
              placeholder={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-card text-text-primary rounded-xl px-4 py-3 outline-none border border-border focus:border-accent mb-3"
              required
            />
            <input
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-card text-text-primary rounded-xl px-4 py-3 outline-none border border-border focus:border-accent mb-1"
              required
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 mb-3"
            >
              {t("auth.signIn")}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            No account?{" "}
            <a href="/signup" className="text-accent hover:underline">
              Create one
            </a>
          </p>
        </>
      )}
    </div>
  );
}
