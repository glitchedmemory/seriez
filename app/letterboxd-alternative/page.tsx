import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://seriez.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Letterboxd Alternative for TV Shows and Anime | Seriez",
  description:
    "Letterboxd is films only. Seriez tracks films, TV shows, and anime in one library, with episode progress, ratings, reviews, collections, and a yearly recap.",
  alternates: { canonical: `${SITE_URL}/letterboxd-alternative` },
  openGraph: {
    title: "Letterboxd Alternative for TV Shows and Anime | Seriez",
    description:
      "Keep the film diary habit and add the rest of what you watch. Films, TV shows, and anime in one library, with episode level progress.",
    url: `${SITE_URL}/letterboxd-alternative`,
    siteName: "Seriez",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Letterboxd Alternative for TV Shows and Anime | Seriez",
    description:
      "Keep the film diary habit and add the rest of what you watch. Films, TV shows, and anime in one library, with episode level progress.",
  },
};

const FAQS = [
  {
    q: "Is Seriez a full replacement for Letterboxd?",
    a: "For tracking and rating, yes: films get the same treatment here. What Seriez does not have is Letterboxd's film writing culture, its decades of lists, and the size of its community. Plenty of people keep both, and that is a reasonable setup.",
  },
  {
    q: "Does Seriez track TV episodes?",
    a: "Yes. You check off episodes as you watch them, and each show shows how far into the season you are. Letterboxd does not do this because it covers films only.",
  },
  {
    q: "How does the anime tracking work?",
    a: "Anime comes from AniList, so seasons, episode counts, and specials follow the real structure instead of being approximated from a film and TV database. Anime shares a library with your films and series.",
  },
  {
    q: "Can I import my Letterboxd history?",
    a: "Not today. TV Time CSV import is the only importer Seriez supports right now, and your Letterboxd films would need to be re-added by hand.",
  },
  {
    q: "Is it free?",
    a: "Yes. Accounts, tracking, ratings, reviews, and comments are free. Golden Ticket is an optional paid tier for extras such as unlimited collections, published lists, and the yearly recap.",
  },
];

export default function LetterboxdAlternativePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Letterboxd Alternative for TV Shows and Anime",
    description:
      "What Seriez does that Letterboxd does not, and where Letterboxd is still the better tool.",
    url: `${SITE_URL}/letterboxd-alternative`,
    isPartOf: { "@type": "WebSite", name: "Seriez", url: SITE_URL },
  };

  return (
    <div className="flex-1 bg-bg-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([pageJsonLd, faqJsonLd]) }} />

      <article className="max-w-lg md:max-w-3xl mx-auto px-4 pt-12 pb-20 md:pt-20">
        <p className="text-xs font-semibold tracking-widest text-accent mb-4">LETTERBOXD ALTERNATIVE</p>

        <h1 className="text-3xl md:text-5xl font-bold text-text-primary leading-tight max-w-[24ch]">
          Love Letterboxd, but your watchlist is not only films?
        </h1>

        <p className="mt-6 text-base md:text-lg text-text-secondary leading-relaxed max-w-[62ch]">
          Letterboxd is films, by design. So the series you are six seasons into live in one app, the anime lives in
          another, and the films live here. Seriez puts all three in one library, keeps the diary habit you already have,
          and adds episode level progress for the shows.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
          >
            Create a free account
          </Link>
          <Link
            href="/tv-time-alternative"
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Coming from TV Time instead
          </Link>
        </div>

        <section className="mt-16 md:mt-20">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">One library for everything you watch</h2>

          <div className="mt-8 space-y-9">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Films, with the parts that matter</h3>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[60ch]">
                Rate what you finish, write a review, mark favorites, and build collections. Posters, cast, and runtime
                come from TMDB, the same source Letterboxd uses for its film data.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Series, down to the episode</h3>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[60ch]">
                Follow shows, check off episodes as you go, and see your progress per season. When a new season premieres
                it lands in your feed, so you are not hunting for release dates.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Anime, from AniList</h3>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[60ch]">
                Anime has its own season and episode structure that a film database cannot express. Seriez reads anime
                from AniList, so a split cour does not turn into a duplicate or a wrong episode count.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Recommendations that use your history</h3>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[60ch]">
                The For You section is built from what you rated and finished, across all three media types, instead of
                handing every visitor the same chart.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Where Letterboxd is still better</h2>
          <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
            Being honest about this saves you time. Letterboxd has a film writing culture and a community that took
            fifteen years to build: the reviews are essays, the lists are their own genre, and the annual stats are
            something people look forward to. Seriez is smaller and newer. If film criticism and list making are the
            reason you show up, Letterboxd remains the better home for that, and many people here keep both accounts.
          </p>
          <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
            What Letterboxd deliberately does not do is television and anime. That gap is what Seriez fills. If your
            habit is &quot;film diary plus five shows plus the season&apos;s anime&quot;, one library beats three.
          </p>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Side by side, in plain terms</h2>
          <dl className="mt-6 divide-y divide-border text-sm">
            <div className="py-4">
              <dt className="font-medium text-text-primary">Films</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                Both. Letterboxd has the deeper film community. Seriez has the same tracking basics and puts them next to
                everything else you watch.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">TV shows with episode progress</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                Seriez only. Letterboxd covers films exclusively, which is why episode tracking does not exist there.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">Anime</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                Seriez only, sourced from AniList with real season and episode structure.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">Yearly recap</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                Both offer one. Yours here can cover films, series, and anime in a single recap instead of films alone.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">Importing an existing diary</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                Letterboxd import is not available yet. TV Time CSV import is, if you are arriving from there.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Questions people ask first</h2>
          <div className="mt-6 divide-y divide-border">
            {FAQS.map((item) => (
              <div key={item.q} className="py-5">
                <h3 className="text-sm font-semibold text-text-primary">{item.q}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-[62ch]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Bring the whole habit to one place</h2>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
            Rate the film you watched last night, check off tonight&apos;s episode, and add the anime season you are three
            episodes into. One library, one recap at the end of the year.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
            >
              Create a free account
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent"
            >
              Look around first
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
