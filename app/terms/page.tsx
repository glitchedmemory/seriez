"use client";

import { useTranslations } from "next-intl";

export default function TermsPage() {
  const t = useTranslations("terms");

  const sectionKeys = [
    "acceptance", "accounts", "content", "use",
    "thirdParty", "liability", "changes", "contact",
  ];

  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          {t("title")}
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          {t("lastUpdated")}
        </p>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          {sectionKeys.map((key) => (
            <section key={key}>
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                {t(`sections.${key}.title`)}
              </h2>
              {key === "contact" ? (
                <p>
                  {t.rich(`sections.${key}.content`, {
                    a: (chunks) => (
                      <a
                        href="mailto:support@seriez.app"
                        className="text-accent hover:underline"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              ) : (
                <p>{t(`sections.${key}.content`)}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
