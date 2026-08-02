import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TVRedirect({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) redirect("/404");
  redirect(`/tv/${numId}/season/1`);
}
