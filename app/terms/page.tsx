import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Seriez",
  description: "Terms of Service for Seriez.",
  openGraph: { title: "Terms of Service — Seriez" },
  twitter: { title: "Terms of Service — Seriez" },
};

export default function TermsPage() {
  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Terms of Service</h1>
        <p className="text-text-secondary text-sm mb-8">Last updated: June 20, 2026</p>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">1. Acceptance of Terms</h2>
            <p>
              By using Seriez, you agree to these Terms of Service. If you do
              not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">2. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">3. User Content</h2>
            <p>
              You retain ownership of the reviews, ratings, comments, and other
              content you post. By posting, you grant Seriez a non-exclusive,
              royalty-free license to display and distribute your content on the
              platform. You are solely responsible for the content you post and
              warrant that it does not violate any laws or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">4. Acceptable Use</h2>
            <p>
              You agree not to post content that is unlawful, harassing,
              defamatory, abusive, threatening, obscene, or otherwise
              objectionable. Seriez reserves the right to remove any content and
              suspend or terminate accounts at its sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">5. Golden Ticket Subscriptions</h2>
            <p>
              Golden Ticket is a recurring subscription at $4.99/month or
              $35/year. Payments are processed through Stripe. You may cancel at
              any time; cancellation takes effect at the end of the current
              billing period. No refunds for partial months.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">6. Third-Party Content</h2>
            <p>
              Seriez displays movie, TV, and anime metadata from TMDB and
              AniList. Seriez is not affiliated with or endorsed by these
              services. All movie and TV show images and data are provided by
              TMDB under their terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">7. Limitation of Liability</h2>
            <p>
              Seriez is provided &ldquo;as is&rdquo; without warranties of any
              kind. Seriez shall not be liable for any damages arising from the
              use or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">8. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued
              use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">9. Contact</h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a href="mailto:seriez.app@gmail.com" className="text-accent hover:underline">
                seriez.app@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
