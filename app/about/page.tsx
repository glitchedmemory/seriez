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

        </section>
      </div>
    </div>
  );
}
