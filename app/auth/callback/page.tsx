"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    async function handleCallback() {
      // Use regular supabase-js client (not ssr) — handles localStorage natively
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      if (typeof window === "undefined" || !window.location.hash) {
        setStatus("error");
        return;
      }

      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        setStatus("error");
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.user) {
        setStatus("error");
        return;
      }

      // Get username from public.users
      let username: string | null = null;
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("username")
          .eq("id", data.user.id)
          .single();
        username = userData?.username ?? null;
      } catch {}

      // Set cookie for SSR middleware
      if (username) {
        document.cookie =
          `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
      }

      router.replace(username ? "/" : "/welcome");
    }

    handleCallback();
  }, []);

  if (status === "error") {
    return (
      <div className="max-w-sm mx-auto px-4 pt-20 text-center">
        <p className="text-red-400 text-lg mb-4">
          Could not verify your email. Please try again.
        </p>
        <a href="/login" className="text-accent hover:underline">
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-20 text-center">
      <p className="text-text-secondary">Verifying your email...</p>
    </div>
  );
}
