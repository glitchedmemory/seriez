import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Seriez",
  description: "About Seriez — track movies, TV shows, and anime.",
  openGraph: { title: "About — Seriez" },
  twitter: { title: "About — Seriez" },
};

export default function AboutPage() {
  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-8">About Seriez</h1>

        <section className="space-y-6 text-text-secondary leading-relaxed">
          <p>
            Seriez is a tracking platform for movies, TV shows, and anime. Log
            what you watch, rate it, write reviews, and build your personal
            library — all in one place.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">What you can do</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Track movies, TV shows, and anime in a unified library</li>
            <li>Rate and review everything you watch</li>
            <li>Create custom collections to organize your library</li>
            <li>Explore box office charts across 9 countries</li>
            <li>Discover new titles with Roulette and mood-based search</li>
            <li>Connect with other viewers through shared reviews and comments</li>
          </ul>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">Golden Ticket</h2>
          <p>
            Unlock premium features with a Golden Ticket for $4.99/month. Pro
            members get unlimited collections, yearly recaps, CSV data exports,
            and more.
          </p>
        </section>
      </div>
    </div>
  );
}
