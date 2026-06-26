"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();

      // Try PKCE flow — hash contains access_token, refresh_token, type
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error: sessionErr } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (!sessionErr && data.user) {
            // Check if user has a username in public.users
            let username: string | null = null;
            try {
              const { data: userData } = await supabase
                .from("users")
                .select("username")
                .eq("id", data.user.id)
                .single();
              username = userData?.username ?? null;
            } catch {}

            if (username) {
              document.cookie = `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
            }

            const target = username ? "/" : "/welcome";
            router.replace(target);
            return;
          }
        }
      }

      // Fallback: try code param (older flow)
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeErr } =
          await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeErr) {
          const { data: authData } = await supabase.auth.getUser();
          if (authData.user) {
            let username: string | null = null;
            try {
              const { data: userData } = await supabase
                .from("users")
                .select("username")
                .eq("id", authData.user.id)
                .single();
              username = userData?.username ?? null;
            } catch {}

            if (username) {
              document.cookie = `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
            }

            const target = username ? "/" : "/welcome";
            router.replace(target);
            return;
          }
        }
      }

      // Try getSession as last resort
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const uid = sessionData.session.user.id;
        let username: string | null = null;
        try {
          const { data: userData } = await supabase
            .from("users")
            .select("username")
            .eq("id", uid)
            .single();
          username = userData?.username ?? null;
        } catch {}

        if (username) {
          document.cookie = `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
        }

        router.replace(username ? "/" : "/welcome");
        return;
      }

      setError("Could not verify your email. Please try again.");
    }

    handleCallback();
  }, []);

  return (
    <div className="max-w-sm mx-auto px-4 pt-20 text-center">
      {error ? (
        <>
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/login" className="text-accent hover:underline">
            Go to login
          </a>
        </>
      ) : (
        <p className="text-text-secondary">Verifying your email...</p>
      )}
    </div>
  );
}
