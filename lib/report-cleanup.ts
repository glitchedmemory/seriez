import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 콘텐츠를 지울 때 그 콘텐츠를 가리키는 신고도 함께 지운다.
 *
 * 신고는 "이 콘텐츠가 문제입니다"라는 표시일 뿐이라 콘텐츠가 사라지면 의미가 없다.
 * 남겨 두면 실제로 없는 것을 가리키는 신고가 쌓여서 관리자 대시보드 숫자가
 * 실제 상황을 뜻하지 않게 된다 (그래서 8건이 유령으로 남아 있었다).
 */
export async function deleteReportsForContent(targetIds: Array<string | number | null | undefined>): Promise<number> {
  const ids = Array.from(new Set(targetIds.filter(Boolean).map(String)));
  if (ids.length === 0) return 0;
  try {
    const { error, count } = await supabaseAdmin
      .from("reports")
      .delete({ count: "exact" })
      .in("target_id", ids);
    if (error) {
      console.error("[report-cleanup] delete failed:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e: any) {
    console.error("[report-cleanup] unexpected:", e?.message || e);
    return 0;
  }
}
