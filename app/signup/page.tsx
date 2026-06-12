"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "short">("idle");
  const router = useRouter();
  const supabase = createClient();

  // Username duplicate check (debounced on blur)
  async function checkUsername(u: string) {
    const trimmed = u.trim();
    if (trimmed.length < 2) {
      setUsernameStatus("short");
      return;
    }
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.reserved || data.exists || data.error) {
        setUsernameStatus("taken");
        return;
      }
      setUsernameStatus("available");
    } catch {
      setUsernameStatus("idle");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Password validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must include at least one uppercase letter");
      setLoading(false);
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must include at least one lowercase letter");
      setLoading(false);
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      setError("Password must include at least one special character (!@#$ etc.)");
      setLoading(false);
      return;
    }

    // Username duplicate check
    if (usernameStatus === "taken") {
      setError("This username is already taken");
      setLoading(false);
      return;
    }

    const oldUsername = localStorage.getItem("seriez-username");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          username: username.trim(),
          migrated_from: oldUsername || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      localStorage.setItem("seriez-username", username.trim());
      router.push("/profile?welcome=1");
      router.refresh();
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-20 pb-32">
      <div className="flex justify-center mb-6">
        <img src="/seriez-logo-white.png" alt="Seriez" className="h-32 w-auto" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Create account</h1>
      <p className="text-sm text-[#9ca3af] mb-6">Start tracking what you watch</p>

      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setUsernameStatus("idle"); }}
          onBlur={(e) => checkUsername(e.target.value)}
          className={`w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 outline-none border mb-1 ${
            usernameStatus === "available" ? "border-emerald-500" :
            usernameStatus === "taken" || usernameStatus === "short" ? "border-red-500" :
            "border-[#2d2d4a] focus:border-[#6366f1]"
          }`}
          required
          maxLength={20}
        />
        <div className="h-4 mb-2">
          {usernameStatus === "checking" && <p className="text-[10px] text-[#6b7280]">Checking...</p>}
          {usernameStatus === "available" && <p className="text-[10px] text-emerald-400">✓ Available</p>}
          {usernameStatus === "taken" && <p className="text-[10px] text-red-400">✗ Already taken</p>}
          {usernameStatus === "short" && <p className="text-[10px] text-red-400">Min 2 characters</p>}
        </div>
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
          placeholder="Password (8+ chars, upper/lower/special)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 outline-none border border-[#2d2d4a] focus:border-[#6366f1] mb-1"
          required
          minLength={8}
        />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#6366f1] text-white font-semibold hover:bg-[#818cf8] transition-colors disabled:opacity-50 mb-3"
        >
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-[#9ca3af]">
        Already have an account?{" "}
        <a href="/login" className="text-[#6366f1] hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
