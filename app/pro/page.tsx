import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Golden Ticket — Seriez",
  description: "Unlock premium features with a Golden Ticket — $4.99/month.",
  openGraph: { title: "Golden Ticket — Seriez" },
  twitter: { title: "Golden Ticket — Seriez" },
};

const features = [
  "Unlimited custom collections — organize your library your way",
  "Roulette Discovery — spin to find your next watch",
  "Yearly Recap — your watching year in review",
  "CSV Data Export — download your full library as a spreadsheet",
  "Golden Ticket badge on your profile",
];

const comingSoon = [
  "Advanced Stats Dashboard — genre trends, director rankings, and more",
  "Ad-free experience",
];

export default function ProPage() {
  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          <span className="text-gold">✨</span> Golden Ticket
        </h1>
        <p className="text-text-secondary mb-8">Unlock the full Seriez experience.</p>

        {/* Pricing */}
        <div className="bg-bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-text-primary">$4.99</span>
            <span className="text-text-secondary">/ month</span>
          </div>
          <p className="text-text-secondary text-sm">Or $35 / year — save 40%</p>
        </div>

        {/* Features */}
        <h2 className="text-xl font-semibold text-text-primary mb-4">Included Features</h2>
        <ul className="space-y-3 mb-8">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-text-secondary">
              <span className="text-gold mt-0.5 shrink-0">✦</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Coming Soon */}
        <h2 className="text-xl font-semibold text-text-primary mb-4">Coming Soon</h2>
        <ul className="space-y-3 mb-8">
          {comingSoon.map((f) => (
            <li key={f} className="flex items-start gap-3 text-text-secondary">
              <span className="text-text-secondary mt-0.5 shrink-0">◇</span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="bg-bg-card border border-accent/30 rounded-xl p-6 text-center">
          <p className="text-text-secondary mb-4">
            Golden Ticket purchases are processed securely through Stripe.
          </p>
          <Link
            href="/profile/settings?tab=pro"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Upgrade to Golden Ticket
          </Link>
        </div>
      </div>
    </div>
  );
}
