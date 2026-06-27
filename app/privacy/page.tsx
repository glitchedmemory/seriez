"use client";

import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

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
          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.info.title")}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              {(["account", "usage", "technical"] as const).map((item) => (
                <li key={item}>
                  {t.rich(`sections.info.items.${item}`, {
                    strong: (chunks) => (
                      <strong className="text-text-primary">{chunks}</strong>
                    ),
                  })}
                </li>
              ))}
            </ul>
          </section>

          {/* 2. How We Use Your Data */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.usage.title")}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              {(["provide", "display", "communicate", "improve"] as const).map((item) => (
                <li key={item}>{t(`sections.usage.items.${item}`)}</li>
              ))}
            </ul>
          </section>

          {/* 3. Data Sharing */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.sharing.title")}
            </h2>
            <p className="mb-3">
              {t.rich("sections.sharing.intro", {
                strong: (chunks) => (
                  <strong className="text-text-primary">{chunks}</strong>
                ),
              })}
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                {t.rich("sections.sharing.paddle", {
                  a: (chunks) => (
                    <a
                      href="https://paddle.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </li>
              <li>{t("sections.sharing.legal")}</li>
            </ul>
          </section>

          {/* 4. Data Storage and Security */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.storage.title")}
            </h2>
            <p>{t("sections.storage.content")}</p>
          </section>

          {/* 5. Your Rights */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.rights.title")}
            </h2>
            <p className="mb-2">{t("sections.rights.intro")}</p>
            <ul className="list-disc pl-6 space-y-1">
              {(["access", "correct", "export", "delete"] as const).map((item) => (
                <li key={item}>{t(`sections.rights.items.${item}`)}</li>
              ))}
            </ul>
          </section>

          {/* 6. Cookies */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.cookies.title")}
            </h2>
            <p>{t("sections.cookies.content")}</p>
          </section>

          {/* 7. Changes to This Policy */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.changes.title")}
            </h2>
            <p>{t("sections.changes.content")}</p>
          </section>

          {/* 8. Contact */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {t("sections.contact.title")}
            </h2>
            <p>
              {t.rich("sections.contact.content", {
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
          </section>
        </div>
      </div>
    </div>
  );
}
