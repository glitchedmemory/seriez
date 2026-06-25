// Generates Schema.org JSON-LD structured data for movies, TV shows, anime, and persons.
// Used by AI search engines (Google SGE, Bing Chat, Perplexity, Claude) to understand content.
export interface MovieSchema {
  title: string;
  description: string;
  posterUrl: string | null;
  rating: number;
  ratingCount: number;
  releaseYear: number;
  genres: string[];
  url: string;
}

export interface TVSchema extends MovieSchema {
  totalSeasons: number;
  status: string;
  networks: string[];
}

export interface PersonSchema {
  name: string;
  image: string | null;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  jobTitle: string;
  description: string;
  url: string;
  sameAs: string;
  knownCredits: { title: string; role: string; year: number }[];
}

export function generateMovieJsonLd(data: MovieSchema) {
  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: data.title,
    description: data.description,
    image: data.posterUrl,
    aggregateRating: data.rating > 0 ? {
      "@type": "AggregateRating",
      ratingValue: data.rating,
      bestRating: "10",
      ratingCount: data.ratingCount || 1,
      source: "Seriez Community",
    } : undefined,
    datePublished: data.releaseYear > 0 ? `${data.releaseYear}` : undefined,
    genre: data.genres,
    url: data.url,
    sameAs: `https://seriez.app${data.url}`,
  };
}

export function generateTVJsonLd(data: TVSchema) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: data.title,
    description: data.description,
    image: data.posterUrl,
    aggregateRating: data.rating > 0 ? {
      "@type": "AggregateRating",
      ratingValue: data.rating,
      bestRating: "10",
      ratingCount: data.ratingCount || 1,
      source: "Seriez Community",
    } : undefined,
    datePublished: data.releaseYear > 0 ? `${data.releaseYear}` : undefined,
    genre: data.genres,
    url: data.url,
    numberOfSeasons: data.totalSeasons,
    productionStatus: data.status,
    sameAs: `https://seriez.app${data.url}`,
  };
}

export function generatePersonJsonLd(data: PersonSchema) {
  const topCredits = data.knownCredits.slice(0, 10).map(c => `${c.title} (${c.year}) as ${c.role}`);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: data.name,
    image: data.image,
    birthDate: data.birthDate || undefined,
    deathDate: data.deathDate || undefined,
    birthPlace: data.birthPlace || undefined,
    jobTitle: data.jobTitle,
    description: data.description,
    url: `https://seriez.app${data.url}`,
    sameAs: data.sameAs,
    knowsAbout: topCredits,
  };
}

export function StructuredDataScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
