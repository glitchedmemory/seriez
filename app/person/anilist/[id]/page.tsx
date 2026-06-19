import { getStaffDetail } from "@/lib/anilist";
import AnimeStaffClient from "@/components/AnimeStaffClient";
import { notFound } from "next/navigation";

export default async function AnimeStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staffId = parseInt(id, 10);
  if (isNaN(staffId)) notFound();

  const staff = await getStaffDetail(staffId);
  if (!staff) notFound();

  return <AnimeStaffClient staff={staff} />;
}
