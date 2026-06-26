"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const [debug, setDebug] = useState<string[]>([]);

  useEffect(() => {
    async function run() {
      const log = (msg: string) => setDebug((prev) => [...prev, msg]);

      log("1. useEffect started");

      if (typeof window === "undefined") {
        log("FAIL: no window");
        return;
      }

      const hash = window.location.hash;
      log(`2. hash: ${hash.substring(0, 200)}`);

      if (!hash) {
        log("FAIL: empty hash");
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const at = params.get("access_token");
      const rt = params.get("refresh_token");
      log(`3. access_token: ${at ? at.substring(0, 20) + "..." : "MISSING"}`);
      log(`4. refresh_token: ${rt ? rt.substring(0, 10) + "..." : "MISSING"}`);

      if (!at || !rt) {
        log("FAIL: missing tokens");
        return;
      }

      log("5. creating supabase client...");
      const supabase = createClient(
        "https://zntyjtjodyzizoafxord.supabase.co",
        "sb_publishable_6_O4sP7ZZBT4wxHMVwVtGg_rIgRD1NH"
      );

      log("6. calling setSession...");
      const { data, error } = await supabase.auth.setSession({
        access_token: at,
        refresh_token: rt,
      });

      if (error) {
        log(`FAIL setSession: ${error.message}`);
        return;
      }

      if (!data.user) {
        log("FAIL setSession: no user in data");
        return;
      }

      log(`7. setSession OK. user.id=${data.user.id.substring(0, 8)}...`);

      // Get username
      let username: string | null = null;
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("username")
          .eq("id", data.user.id)
          .single();
        username = userData?.username ?? null;
        log(`8. username: ${username || "null"}`);
      } catch (e: any) {
        log(`8. username query failed: ${e.message}`);
      }

      if (username) {
        document.cookie = `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
        localStorage.setItem("seriez-username", username);
      }

      log("9. redirecting...");
      window.location.replace(username ? "/" : "/welcome");
    }

    run();
  }, []);

  return (
    <div className="max-w-sm mx-auto px-4 pt-20">
      <h1 className="text-lg font-bold text-text-primary mb-4">Auth Debug</h1>
      {debug.length === 0 ? (
        <p className="text-text-secondary">Starting...</p>
      ) : (
        <pre className="text-xs text-text-secondary bg-bg-card p-4 rounded-xl whitespace-pre-wrap">
          {debug.join("\n")}
        </pre>
      )}
    </div>
  );
}
