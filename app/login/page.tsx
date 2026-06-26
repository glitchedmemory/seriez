"use client";

import { useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function LoginContent() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const pwChanged = searchParams.get("pw_changed") === "1";

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

  async function handleGoogleLogin() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
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

      {pwChanged && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-5 text-center">
          <p className="text-emerald-400 font-medium text-sm">{t("auth.passwordChanged")}</p>
        </div>
      )}

      {sent ? (
        <div className="bg-bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-text-primary font-medium mb-1">Magic link sent!</p>
          <p className="text-sm text-text-secondary">Check {email} for the sign-in link.</p>
        </div>
      ) : (
        <>
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-xl bg-white text-gray-800 font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 mb-4 border border-[#2d2d4a]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#2d2d4a]" />
            <span className="text-xs text-text-secondary">or</span>
            <div className="flex-1 h-px bg-[#2d2d4a]" />
          </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-sm mx-auto px-4 pt-20 pb-32"><div className="animate-pulse h-40 bg-bg-card rounded-xl" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
