import type { Metadata } from "next";
import LetterboxdAlternative from "@/components/landing/LetterboxdAlternative";
import { landingMetadata } from "@/lib/landing/meta";

// This URL is the ko version of /letterboxd-alternative. The language is fixed here, not detected,
// so search engines and shared links always land in the same language.
const LOCALE = "ko";

export const metadata: Metadata = landingMetadata("letterboxd-alternative", LOCALE, { canonicalLocale: LOCALE });

export default function LetterboxdAlternativePageKo() {
  return <LetterboxdAlternative locale={LOCALE} />;
}
