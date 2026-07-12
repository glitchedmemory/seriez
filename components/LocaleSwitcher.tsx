"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";

const LANGUAGES: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

export default function LocaleSwitcher() {
  const locale = useLocale();

  const handleChange = useCallback(
    async (next: string) => {
      if (next === locale) return;
      await fetch("/api/set-locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      window.location.reload();
    },
    [locale]
  );

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="text-text-secondary bg-transparent border-none cursor-pointer text-sm outline-none appearance-none hover:text-accent transition-colors"
      aria-label="Language"
    >
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
}
