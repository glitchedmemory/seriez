"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { LANDING_LOCALES } from "./copy";

/**
 * Resolves the language for the alternative landing pages.
 *
 * The site picks the language on the server from Accept-Language (and the SERIEZ_LOCALE
 * cookie), but HTML is also served from the CDN cache in a single language. When that
 * happens the server locale arrives as English, so this hook falls back to the visitor's
 * own language, matching what the middleware would have done on a cache miss.
 *
 * Order of precedence: explicit cookie choice, then browser language, then server locale.
 */
export function useLandingLocale(): string {
  const serverLocale = useLocale();
  const [locale, setLocale] = useState(serverLocale);

  useEffect(() => {
    const known = LANDING_LOCALES as readonly string[];

    const cookieMatch = document.cookie.match(/(?:^|;\s*)SERIEZ_LOCALE=([^;]+)/);
    const cookieLocale = cookieMatch?.[1];
    if (cookieLocale && known.includes(cookieLocale)) {
      setLocale((prev) => (prev === cookieLocale ? prev : cookieLocale));
      return;
    }

    const candidates = (
      navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]
    ).map((tag) => String(tag).split("-")[0].toLowerCase());

    const hit = candidates.find((tag) => known.includes(tag));
    if (hit) setLocale((prev) => (prev === hit ? prev : hit));
  }, []);

  return locale;
}
