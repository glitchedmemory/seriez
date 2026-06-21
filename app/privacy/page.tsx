import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Seriez",
  description: "Privacy Policy for Seriez.",
  openGraph: { title: "Privacy Policy — Seriez" },
  twitter: { title: "Privacy Policy — Seriez" },
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-text-secondary text-sm mb-8">Last updated: June 20, 2026</p>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong className="text-text-primary">Account data:</strong>{" "}
                username, email address, and profile information you provide.
              </li>
              <li>
                <strong className="text-text-primary">Usage data:</strong>{" "}
                your watch history, ratings, reviews, collections, and
                interactions on the platform.
              </li>
              <li>
                <strong className="text-text-primary">Technical data:</strong>{" "}
                IP address, browser type, and device information collected
                automatically for security and performance purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>To provide and maintain the Seriez platform</li>
              <li>To display your public profile, reviews, and activity</li>
              <li>To send essential account-related communications</li>
              <li>To improve the service and fix issues</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">3. Data Sharing</h2>
            <p>
              We do <strong className="text-text-primary">not</strong> sell your
              personal data to third parties. We share data only:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                With Stripe for payment processing — Stripe receives your email
                and payment details under{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  their privacy policy
                </a>
              </li>
              <li>When required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">4. Data Storage and Security</h2>
            <p>
              Your data is stored on secure servers with industry-standard
              encryption. We take reasonable measures to protect your
              information, but no method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Export your data (available in Settings)</li>
              <li>Delete your account (available in Settings)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">6. Cookies</h2>
            <p>
              We use essential cookies for authentication and session
              management. We do not use tracking or advertising cookies. No
              cookie consent banner is required as we only use strictly
              necessary cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">7. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will
              be communicated via email or a notice on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">8. Contact</h2>
            <p>
              For privacy-related inquiries, contact us at{" "}
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
