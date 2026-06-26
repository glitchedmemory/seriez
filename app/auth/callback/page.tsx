"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();

      // Try getting session — Supabase SSR client auto-picks up hash tokens
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

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
          // Set cookie for backward compatibility
          document.cookie =
            `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
        }

        router.replace(username ? "/" : "/welcome");
        return;
      }

      // If getSession failed, try manual hash parsing
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!setErr && data.user) {
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
              document.cookie =
                `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
            }

            router.replace(username ? "/" : "/welcome");
            return;
          }
        }
      }

      // All attempts failed
      setStatus("error");
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
