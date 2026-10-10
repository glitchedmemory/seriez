import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import TvTimeAlternative from "@/components/landing/TvTimeAlternative";
import { landingMetadata } from "@/lib/landing/meta";

// The bare path is the English version and the x-default; every other language has its own
// real URL (/es/tv-time-alternative ...) and all of them are declared as alternates here.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return landingMetadata("tv-time-alternative", locale, { canonicalLocale: "en" });
}

export default function TvTimeAlternativePage() {
  return <TvTimeAlternative />;
}
