import { getPersonDetail } from "@/lib/tmdb";
import PersonClient from "@/components/PersonClient";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { generatePersonJsonLd, StructuredDataScript } from "@/lib/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) return { title: "Seriez" };

  const person = await getPersonDetail(personId);
  if (!person) return { title: "Seriez" };

  const knownTitles = [
    ...person.movieCredits.slice(0, 3).map(m => m.title),
    ...person.tvCredits.slice(0, 3).map(t => t.title),
  ].join(", ");

  const description = `${person.name} — ${person.knownFor}. Known for ${knownTitles}. Full filmography, biography, and ratings on Seriez.`;

  return {
    title: `${person.name} — Seriez`,
    description,
    openGraph: {
      title: `${person.name} — Seriez`,
      description,
      images: person.photo ? [{ url: person.photo }] : [],
    },
  };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) notFound();

  const person = await getPersonDetail(personId);
  if (!person) notFound();

  const knownTitles = [
    ...person.movieCredits.slice(0, 5).map(m => m.title),
    ...person.tvCredits.slice(0, 5).map(t => t.title),
  ].join(", ");

  const jsonLd = generatePersonJsonLd({
    name: person.name,
    image: person.photo,
    birthDate: person.birthday,
    deathDate: person.deathday,
    birthPlace: person.birthplace,
    jobTitle: person.knownFor,
    description: `${person.name} is ${person.knownFor.toLowerCase()}, known for ${knownTitles}.`,
    url: `/person/${person.id}`,
    sameAs: `https://www.themoviedb.org/person/${person.id}`,
    knownCredits: [
      ...person.movieCredits.slice(0, 20).map(m => ({ title: m.title, role: m.character, year: m.year })),
      ...person.tvCredits.slice(0, 10).map(t => ({ title: t.title, role: t.character, year: t.year })),
    ],
  });

  return (
    <>
      <StructuredDataScript data={jsonLd} />
      <PersonClient person={person} />
    </>
  );
}