"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ProPage() {
  const t = useTranslations("pro");
  const [user, setUser] = useState<{ email?: string } | null | undefined>(undefined);
  const features: string[] = t.raw("features");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUser(data.user ?? null)).catch(() => setUser(null));
  }, []);

  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t("title")}</h1>
        <p className="text-text-secondary mb-8">{t("subtitle")}</p>

        {/* Pricing */}
        <div className="bg-bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-text-primary">{t("priceMonthly")}</span>
            <span className="text-text-secondary">{t("perMonth")}</span>
          </div>
          <p className="text-text-secondary text-sm">{t("priceYearly")}</p>
        </div>

        {/* Features */}
        <h2 className="text-xl font-semibold text-text-primary mb-4">{t("includedFeatures")}</h2>
        <ul className="space-y-3 mb-8">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-text-secondary">
              <span className="text-gold mt-0.5 shrink-0">✦</span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="bg-bg-card border border-accent/30 rounded-xl p-6 text-center">
          {user === undefined ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : !user ? (
            <>
              <p className="text-text-secondary mb-4">Sign in to upgrade to Golden Ticket.</p>
              <Link href="/login?redirect=/pro" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                Sign In to Upgrade
              </Link>
            </>
          ) : (
            <>
              <p className="text-text-secondary mb-4">{t("stripeNotice")}</p>
              <Link href="/profile/settings?upgrade=pro" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                {t("upgradeButton")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
