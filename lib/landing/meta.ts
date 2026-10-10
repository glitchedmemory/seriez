import type { Metadata } from "next";
import {
  LETTERBOXD_COPY,
  LANDING_LOCALES,
  OG_LOCALES,
  TV_TIME_COPY,
  landingCopy,
  type LandingCopy,
  type LandingLocale,
} from "./copy";

export const SITE_URL = "https://seriez.app";

export type LandingKind = "tv-time-alternative" | "letterboxd-alternative";

const COPY: Record<LandingKind, Record<LandingLocale, LandingCopy>> = {
  "tv-time-alternative": TV_TIME_COPY,
  "letterboxd-alternative": LETTERBOXD_COPY,
};

/** English lives on the bare path; every other language gets a real /<locale>/... URL. */
export function landingPath(kind: LandingKind, locale?: string): string {
  const base = `/${kind}`;
  if (!locale || locale === "en") return base;
  return `/${locale}${base}`;
}

export function landingCopyFor(kind: LandingKind, locale: string): LandingCopy {
  return landingCopy(COPY[kind], locale);
}

/** Every language version of a landing page, plus x-default for the bare path. */
export function landingAlternates(kind: LandingKind): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of LANDING_LOCALES) languages[l] = `${SITE_URL}${landingPath(kind, l)}`;
  languages["x-default"] = `${SITE_URL}${landingPath(kind)}`;
  return languages;
}

export function landingMetadata(
  kind: LandingKind,
  locale: string,
  options: { canonicalLocale?: string } = {}
): Metadata {
  const c = landingCopyFor(kind, locale);
  const canonicalLocale = options.canonicalLocale ?? locale;

  return {
    metadataBase: new URL(SITE_URL),
    title: c.meta.title,
    description: c.meta.description,
    alternates: {
      canonical: `${SITE_URL}${landingPath(kind, canonicalLocale)}`,
      languages: landingAlternates(kind),
    },
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      url: `${SITE_URL}${landingPath(kind, canonicalLocale)}`,
      siteName: "Seriez",
      type: "website",
      locale: OG_LOCALES[locale as LandingLocale] ?? OG_LOCALES.en,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Seriez, track movies, TV shows and anime" }],
    },
    twitter: {
      card: "summary_large_image",
      title: c.meta.title,
      description: c.meta.description,
      images: ["/og-image.png"],
    },
  };
}
