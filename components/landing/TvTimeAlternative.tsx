"use client";

import Link from "next/link";
import { TV_TIME_COPY, landingCopy } from "@/lib/landing/copy";
import { useLandingLocale } from "@/lib/landing/useLandingLocale";

const SITE_URL = "https://seriez.app";

export default function TvTimeAlternative({ locale: forcedLocale }: { locale?: string }) {
  const detectedLocale = useLandingLocale();
  const locale = forcedLocale ?? detectedLocale;
  const c = landingCopy(TV_TIME_COPY, locale);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: c.meta.title,
    description: c.meta.description,
    url: `${SITE_URL}/tv-time-alternative`,
    inLanguage: locale,
    isPartOf: { "@type": "WebSite", name: "Seriez", url: SITE_URL },
  };

  return (
    <div className="flex-1 bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([pageJsonLd, faqJsonLd]) }}
      />

      <article className="max-w-lg md:max-w-3xl mx-auto px-4 pt-12 pb-20 md:pt-20">
        <p className="text-xs font-semibold tracking-widest text-accent mb-4">{c.eyebrow}</p>

        <h1 className="text-3xl md:text-5xl font-bold text-text-primary leading-tight max-w-[24ch]">{c.h1}</h1>

        <p className="mt-6 text-base md:text-lg text-text-secondary leading-relaxed max-w-[62ch]">{c.lead}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
          >
            {c.ctaPrimary}
          </Link>
          <Link
            href="/profile/settings"
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            {c.ctaSecondary}
          </Link>
        </div>

        <section className="mt-16 md:mt-20">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">{c.section1.title}</h2>
          {c.section1.lead ? (
            <p className="mt-3 text-sm text-text-secondary max-w-[62ch]">{c.section1.lead}</p>
          ) : null}

          <ol className="mt-8 space-y-8">
            {c.section1.items.map((step, i) => (
              <li key={step.t} className="flex gap-5">
                <span className="text-2xl font-bold text-accent/70 leading-none pt-1">{i + 1}</span>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{step.t}</h3>
                  <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[58ch]">{step.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">{c.section2.title}</h2>
          {c.section2.cols ? (
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              {c.section2.cols.map((col) => (
                <div key={col.title}>
                  <h3 className="text-sm font-semibold text-text-primary">{col.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-text-secondary leading-relaxed">
                    {col.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          {c.section2.note ? (
            <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-[62ch]">{c.section2.note}</p>
          ) : null}
        </section>

        {c.section3 ? (
          <section className="mt-16 md:mt-20 pt-10 border-t border-border">
            <h2 className="text-xl md:text-2xl font-semibold text-text-primary">{c.section3.title}</h2>
            <div className="mt-6 space-y-4 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
              {c.section3.items.map((point) => (
                <p key={point.t}>
                  <span className="text-text-primary font-medium">{point.t}</span> {point.b}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">{c.section4.title}</h2>
          <dl className="mt-6 divide-y divide-border text-sm">
            {c.section4.items.map((item) => (
              <div key={item.n} className="py-4">
                <dt className="font-medium text-text-primary">{item.n}</dt>
                <dd className="mt-1 text-text-secondary leading-relaxed">{item.b}</dd>
              </div>
            ))}
          </dl>
          {c.section4.note ? (
            <p className="mt-6 text-sm text-text-secondary leading-relaxed max-w-[62ch]">{c.section4.note}</p>
          ) : null}
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">{c.faq.title}</h2>
          <div className="mt-6 divide-y divide-border">
            {c.faq.items.map((item) => (
              <div key={item.q} className="py-5">
                <h3 className="text-sm font-semibold text-text-primary">{item.q}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-[62ch]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">{c.final.title}</h2>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-[62ch]">{c.final.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
            >
              {c.final.cta}
            </Link>
            <Link
              href="/letterboxd-alternative"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent"
            >
              {c.final.other}
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
