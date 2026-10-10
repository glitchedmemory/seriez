import type { Metadata } from "next";
import LetterboxdAlternative from "@/components/landing/LetterboxdAlternative";
import { landingMetadata } from "@/lib/landing/meta";

// This URL is the fr version of /letterboxd-alternative. The language is fixed here, not detected,
// so search engines and shared links always land in the same language.
const LOCALE = "fr";

export const metadata: Metadata = landingMetadata("letterboxd-alternative", LOCALE, { canonicalLocale: LOCALE });

export default function LetterboxdAlternativePageFr() {
  return <LetterboxdAlternative locale={LOCALE} />;
}
