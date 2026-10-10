import type { Metadata } from "next";
import TvTimeAlternative from "@/components/landing/TvTimeAlternative";
import { landingMetadata } from "@/lib/landing/meta";

// This URL is the ja version of /tv-time-alternative. The language is fixed here, not detected,
// so search engines and shared links always land in the same language.
const LOCALE = "ja";

export const metadata: Metadata = landingMetadata("tv-time-alternative", LOCALE, { canonicalLocale: LOCALE });

export default function TvTimeAlternativePageJa() {
  return <TvTimeAlternative locale={LOCALE} />;
}
