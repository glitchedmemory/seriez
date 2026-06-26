"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  // CRITICAL: capture hash BEFORE Next.js router touches it
  const hashRef = useRef(
    typeof window !== "undefined" ? window.location.hash : ""
  );
  const [debug, setDebug] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Already handled
    if (done) return;

    async function run() {
      const log = (msg: string) => setDebug((prev) => [...prev, msg]);

      const hash = hashRef.current;
      log(`hash: ${hash.substring(0, 200)}`);

      if (!hash || hash.length < 10) {
        log("FAIL: empty/too-short hash");
        return;
      }

      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const at = params.get("access_token");
      const rt = params.get("refresh_token");
      log(`access_token: ${at ? at.substring(0, 20) + "..." : "MISSING"}`);
      log(`refresh_token: ${rt ? rt.substring(0, 10) + "..." : "MISSING"}`);

      if (!at || !rt) {
        log("FAIL: missing tokens in hash");
        return;
      }

      const supabase = createClient(
        "https://zntyjtjodyzizoafxord.supabase.co",
        "sb_publishable_6_O4sP7ZZBT4wxHMVwVtGg_rIgRD1NH"
      );

      log("calling setSession...");
      const { data, error } = await supabase.auth.setSession({
        access_token: at,
        refresh_token: rt,
      });

      if (error) {
        log(`setSession error: ${error.message}`);
        return;
      }
      if (!data.user) {
        log("setSession: no user");
        return;
      }

      log(`setSession OK: ${data.user.id.substring(0, 8)}...`);

      let username: string | null = null;
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("username")
          .eq("id", data.user.id)
          .single();
        username = userData?.username ?? null;
      } catch {}

      log(`username: ${username || "null"}`);

      if (username) {
        document.cookie = `seriez-username=${username};path=/;max-age=31536000;SameSite=Lax`;
        localStorage.setItem("seriez-username", username);
      }

      setDone(true);
      window.location.replace(username ? "/" : "/welcome");
    }

    run();
  }, []);

  return (
    <div className="max-w-sm mx-auto px-4 pt-20">
      <h1 className="text-lg font-bold text-text-primary mb-4">Auth Debug</h1>
      <pre className="text-xs text-text-secondary bg-bg-card p-4 rounded-xl whitespace-pre-wrap">
        {debug.length > 0 ? debug.join("\n") : "loading..."}
      </pre>
    </div>
  );
}
