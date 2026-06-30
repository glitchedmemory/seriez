"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  async function submit() {
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const username = user?.user_metadata?.username || "anonymous";
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page: pathname, username }),
      });
      setSent(true);
      setMessage("");
      setTimeout(() => { setOpen(false); setSent(false); }, 2000);
    } catch {}
    setLoading(false);
  }

  if (open) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
        <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
        <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md mx-4 mb-20 md:mb-0 p-5 shadow-2xl">
          {sent ? (
            <div className="text-center py-4">
              <p className="text-accent text-lg font-semibold">✓ Sent!</p>
              <p className="text-text-secondary text-sm mt-1">Thank you for your feedback.</p>
            </div>
          ) : (
            <>
              <h3 className="text-white font-semibold mb-3">Send Feedback</h3>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                className="w-full bg-bg-surface text-text-primary text-sm rounded-xl p-3 outline-none border border-border focus:border-accent resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={submit}
                  disabled={!message.trim() || loading}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-xl font-medium disabled:opacity-40 hover:bg-[#818cf8] transition-colors"
                >
                  {loading ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Feedback"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 w-11 h-11 rounded-full bg-accent text-white shadow-lg hover:shadow-accent/25 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="13" y2="13" />
      </svg>
    </button>
  );
}
