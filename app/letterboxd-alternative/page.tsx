import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import LetterboxdAlternative from "@/components/landing/LetterboxdAlternative";
import { LETTERBOXD_COPY, OG_LOCALES, landingCopy, type LandingLocale } from "@/lib/landing/copy";

const SITE_URL = "https://seriez.app";
const PATH = "/letterboxd-alternative";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = landingCopy(LETTERBOXD_COPY, locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: c.meta.title,
    description: c.meta.description,
    alternates: { canonical: `${SITE_URL}${PATH}` },
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      url: `${SITE_URL}${PATH}`,
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

export default function LetterboxdAlternativePage() {
  return <LetterboxdAlternative />;
}
