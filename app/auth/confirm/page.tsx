"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") || "signup";

    if (!tokenHash) {
      setStatus("invalid");
      return;
    }

    const supabase = createClient();
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any }).then((res) => {
      if (res.error || !res.data.user) {
        console.error("verifyOtp error:", res.error);
        setStatus("error");
        return;
      }

      // Store username for display fallback
      const uname = res.data.user.user_metadata?.username;
      if (uname) {
        localStorage.setItem("seriez-username", uname);
        document.cookie = `seriez-username=${uname};path=/;max-age=31536000;SameSite=Lax;secure`;
      }

      router.replace("/");
    }).catch((err) => {
      console.error("verifyOtp exception:", err);
      setStatus("error");
    });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="text-center">
        {status === "verifying" && (
          <>
            <div className="w-8 h-8 mx-auto mb-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-text-primary">Verifying your email…</p>
          </>
        )}
        {status === "invalid" && (
          <p className="text-text-primary">Invalid confirmation link. Please try signing up again.</p>
        )}
        {status === "error" && (
          <p className="text-text-primary">Could not verify. Please try signing up again.</p>
        )}
      </div>
    </div>
  );
}
