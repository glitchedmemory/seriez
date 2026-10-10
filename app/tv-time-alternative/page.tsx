import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://seriez.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TV Time Alternative: Import Your Watch History | Seriez",
  description:
    "TV Time shut down on July 15, 2026. Bring your watch history to Seriez with a CSV import from your TV Time export, and track movies, TV shows, and anime in one place.",
  alternates: { canonical: `${SITE_URL}/tv-time-alternative` },
  openGraph: {
    title: "TV Time Alternative: Import Your Watch History | Seriez",
    description:
      "TV Time is gone. Your watch history does not have to be. Import your TV Time CSV export and keep tracking movies, TV shows, and anime in one place.",
    url: `${SITE_URL}/tv-time-alternative`,
    siteName: "Seriez",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TV Time Alternative: Import Your Watch History | Seriez",
    description:
      "TV Time is gone. Your watch history does not have to be. Import your TV Time CSV export and keep tracking movies, TV shows, and anime in one place.",
  },
};

const FAQS = [
  {
    q: "Is Seriez free?",
    a: "Yes. Creating an account, tracking what you watch, rating, reviewing, and importing your TV Time history are all free. Golden Ticket is an optional paid tier for extras such as unlimited collections and published lists.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. Seriez runs in your browser, and you can add it to your phone's home screen so it opens like an app. There is nothing to download from an app store.",
  },
  {
    q: "Which TV Time file do I need?",
    a: "The CSV files from your TV Time data export. TV Time exported two files: tracking-prod-records-v2.csv for your shows and episodes, and tracking-prod-records.csv for your movies. Import one after the other in Settings.",
  },
  {
    q: "Can I import from Trakt, IMDb, or Letterboxd too?",
    a: "Not today. TV Time CSV import is the importer Seriez supports right now.",
  },
  {
    q: "What happened to my TV Time comments and reactions?",
    a: "They were deleted with the app. TV Time never exported comments, GIF reactions, or the community threads around episodes, so no service can bring them back. Ratings, watch history, and favorites are the parts that travel.",
  },
  {
    q: "Does Seriez track anime too?",
    a: "Yes. Anime data comes from AniList, so seasons and episode counts are correct rather than guessed, and anime sits in the same library as your films and series.",
  },
];

export default function TvTimeAlternativePage() {
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
    name: "TV Time Alternative: Import Your Watch History",
    description:
      "How to move your TV Time watch history to Seriez with a CSV import, and what Seriez tracks that TV Time did not.",
    url: `${SITE_URL}/tv-time-alternative`,
    isPartOf: { "@type": "WebSite", name: "Seriez", url: SITE_URL },
  };

  return (
    <div className="flex-1 bg-bg-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([pageJsonLd, faqJsonLd]) }} />

      <article className="max-w-lg md:max-w-3xl mx-auto px-4 pt-12 pb-20 md:pt-20">
        <p className="text-xs font-semibold tracking-widest text-accent mb-4">TV TIME ALTERNATIVE</p>

        <h1 className="text-3xl md:text-5xl font-bold text-text-primary leading-tight max-w-[22ch]">
          TV Time is gone. Your watch history does not have to be.
        </h1>

        <p className="mt-6 text-base md:text-lg text-text-secondary leading-relaxed max-w-[62ch]">
          TV Time shut down on July 15, 2026, and took thirteen years of episode check ins, ratings, and lists with it. If
          you saved your data export in time, you can bring it to Seriez in a few minutes: import the file, keep your
          history, and track movies, TV shows, and anime in one library from now on.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
          >
            Create a free account
          </Link>
          <Link
            href="/profile/settings"
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Go to Import CSV
          </Link>
        </div>

        <section className="mt-16 md:mt-20">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Bring your TV Time history across</h2>
          <p className="mt-3 text-sm text-text-secondary max-w-[62ch]">
            The import takes your file as it came out of TV Time. No reformatting, no third party tool.
          </p>

          <ol className="mt-8 space-y-8">
            <li className="flex gap-5">
              <span className="text-2xl font-bold text-accent/70 leading-none pt-1">1</span>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Find the CSV you exported</h3>
                <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[58ch]">
                  TV Time sent two files: <span className="text-text-primary">tracking-prod-records-v2.csv</span> for
                  shows and episodes, and <span className="text-text-primary">tracking-prod-records.csv</span> for
                  movies. If you missed the export window, the files are gone, but you can still start a fresh library
                  here.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <span className="text-2xl font-bold text-accent/70 leading-none pt-1">2</span>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Create your Seriez account</h3>
                <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[58ch]">
                  Free, no app store download. On a phone you can add Seriez to your home screen so it opens like an app.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <span className="text-2xl font-bold text-accent/70 leading-none pt-1">3</span>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Drop the file into Settings</h3>
                <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-[58ch]">
                  Settings, then Data, then Import CSV. Your watched episodes, ratings, and favorites land in your
                  library, and your progress bars on shows pick up where TV Time left them.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">What travels, and what does not</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Comes with you</h3>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary leading-relaxed">
                <li>Every episode you had marked watched</li>
                <li>Shows you were in the middle of</li>
                <li>Movies you had tracked</li>
                <li>Your ratings and favorites</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Cannot come with you</h3>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary leading-relaxed">
                <li>Episode comments and reactions</li>
                <li>GIF threads and community posts</li>
                <li>Followers and your old profile</li>
              </ul>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                TV Time never exported those, and the servers are gone. What you can do here is start the conversations
                again: every title has a review section, and your ratings feed everyone else&apos;s discovery.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Why people are moving here</h2>
          <div className="mt-6 space-y-4 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
            <p>
              <span className="text-text-primary font-medium">Movies, TV, and anime in one library.</span> Letterboxd
              covers films only. Seriez keeps all three together, so you stop maintaining two or three separate lists.
            </p>
            <p>
              <span className="text-text-primary font-medium">Anime that is actually correct.</span> Anime data comes
              from AniList, so season and episode structure is real, not approximated from a TV database.
            </p>
            <p>
              <span className="text-text-primary font-medium">Episode level progress.</span> Check off episodes as you
              watch and see how far into a season you are, the same habit TV Time built.
            </p>
            <p>
              <span className="text-text-primary font-medium">Discovery that uses your ratings.</span> The For You
              section reads your history and suggests what to watch next instead of showing the same popular list to
              everyone.
            </p>
            <p>
              <span className="text-text-primary font-medium">A year in review you can show off.</span> Golden Ticket
              members get a yearly recap with hours watched, top genres, and your best rated titles.
            </p>
          </div>
        </section>

        <section className="mt-16 md:mt-20 pt-10 border-t border-border">
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Where Seriez fits among the alternatives</h2>
          <dl className="mt-6 divide-y divide-border text-sm">
            <div className="py-4">
              <dt className="font-medium text-text-primary">Trakt</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                A long running tracker with deep media server integrations and a strong API. Best if your setup already
                runs through Plex or Kodi, and some features sit behind the paid VIP tier.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">Simkl</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                The closest match to TV Time&apos;s mobile feel, with automatic tracking from streaming services. Its
                servers struggled under the surge of people arriving in July.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">Serializd</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                A Letterboxd style home for television, built around reviews and a clean feed. Television only, so your
                films and anime live somewhere else.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium text-text-primary">Bingers</dt>
              <dd className="mt-1 text-text-secondary leading-relaxed">
                Built by the developer behind TV Time, which is why so much of the community landed there. Its comment
                sections are the closest thing to the old episode threads.
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
            Seriez is the one that treats all three media types as first class, and it is the only one on this list where
            anime comes from AniList rather than a film and TV database.
          </p>
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
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary">Start with the file you already have</h2>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-[62ch]">
            Create an account, import your export, and your library is back in a few minutes. If you never got your data
            out of TV Time, start empty. The tracking works the same either way.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
            >
              Create a free account
            </Link>
            <Link
              href="/letterboxd-alternative"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent"
            >
              Also track films? See the Letterboxd comparison
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
