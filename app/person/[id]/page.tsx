import { getPersonDetail } from "@/lib/tmdb";
import PersonClient from "@/components/PersonClient";
import { notFound } from "next/navigation";

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

  return <PersonClient person={person} />;
}