"use client";

import { useTranslations } from "next-intl";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-8">
          {t("title")}
        </h1>

        <section className="space-y-6 text-text-secondary leading-relaxed">
          <p>{t("description")}</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">
            {t("whatYouCanDo")}
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t("smartRoulette")}</li>
            <li>{t("trackLibrary")}</li>
            <li>{t("rateReview")}</li>
            <li>{t("createCollections")}</li>
            <li>{t("boxOffice")}</li>
            <li>{t("discover")}</li>
            <li>{t("community")}</li>
          </ul>

          <div className="mt-12 p-6 bg-bg-card border border-accent/20 rounded-2xl">
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Coming from TV Time?
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              TV Time shut down on July 15, 2026. Seriez supports direct CSV import from your TV Time GDPR export — drag and drop your file in Settings → Data → Import CSV. Your watch history, episode progress, and favorites come with you.
            </p>
            <a
              href="/profile/settings"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-light transition-colors"
            >
              Import your TV Time data →
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
