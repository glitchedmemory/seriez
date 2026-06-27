export const metadata = {
  title: "Refund Policy - Seriez",
  description: "Seriez refund and cancellation policy.",
};

export default function RefundPage() {
  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Refund Policy
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          Last updated: June 27, 2026
        </p>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Managing Your Subscription
            </h2>
            <p>
              You can cancel, pause, or update your payment method at any time
              through the Paddle customer portal, accessible from your account
              settings. Cancellation takes effect at the end of the current
              billing period — you retain access to premium features until then.
              No need to contact us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Refund Eligibility
            </h2>
            <p>
              If you are not satisfied with your purchase, you may request a full
              refund within 14 days of the initial payment. Refund requests
              submitted after 14 days are reviewed on a case-by-case basis.
              Refunds are issued to the original payment method and typically
              appear within 5–10 business days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Requesting a Refund
            </h2>
            <p>
              To request a refund, email{" "}
              <a
                href="mailto:support@seriez.app"
                className="text-accent hover:underline"
              >
                support@seriez.app
              </a>{" "}
              with your account email and purchase details. We respond within
              48 hours. For cancellations, use the Paddle customer portal in
              your settings — no email needed.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
