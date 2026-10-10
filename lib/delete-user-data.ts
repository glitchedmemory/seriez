import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CleanupStep {
  table: string;
  filter: string;
  deleted: number | null;
  error?: string;
}

export interface CleanupResult {
  steps: CleanupStep[];
  failures: CleanupStep[];
}

/**
 * 계정을 지울 때 그 계정의 데이터를 전부 정리한다.
 *
 * 표마다 사용자를 가리키는 칸이 다르다. 어떤 표는 계정 아이디(users.id)를,
 * 어떤 표는 계정 이름을 담고 있어서, 이름으로 아이디 칸을 조회하면 아무것도
 * 지워지지 않고 조용히 넘어간다 (그래서 남은 기록이 쌓였다). 여기서는 표마다
 * 맞는 칸을 쓰고, 실패하면 결과에 남겨서 조용히 지나가지 않게 한다.
 */
export async function deleteUserData(userId: string, username: string): Promise<CleanupResult> {
  const steps: CleanupStep[] = [];

  const run = async (table: string, filter: string, build: () => any) => {
    try {
      const { error, count } = await build();
      steps.push({ table, filter, deleted: count ?? null, ...(error ? { error: error.message } : {}) });
    } catch (e: any) {
      steps.push({ table, filter, deleted: null, error: e?.message || "unknown" });
    }
  };

  // 계정 아이디(users.id)를 담는 칸
  await run("media_trackings", "username = id", () =>
    supabaseAdmin.from("media_trackings").delete({ count: "exact" }).eq("username", userId)
  );
  // 에피소드 기록은 users 표와 연결 고리가 없어서 직접 지워야 한다 (안 지우면 주인 없는 기록이 남는다)
  await run("episode_watches", "username = id", () =>
    supabaseAdmin.from("episode_watches").delete({ count: "exact" }).eq("username", userId)
  );
  await run("follows", "follower_id", () =>
    supabaseAdmin.from("follows").delete({ count: "exact" }).eq("follower_id", userId)
  );
  await run("follows", "following_id", () =>
    supabaseAdmin.from("follows").delete({ count: "exact" }).eq("following_id", userId)
  );

  // 계정 이름을 담는 칸
  await run("reviews", "username = name", () =>
    supabaseAdmin.from("reviews").delete({ count: "exact" }).eq("username", username)
  );
  await run("review_comments", "username = name", () =>
    supabaseAdmin.from("review_comments").delete({ count: "exact" }).eq("username", username)
  );
  await run("comment_likes", "username = name", () =>
    supabaseAdmin.from("comment_likes").delete({ count: "exact" }).eq("username", username)
  );
  await run("content_visits", "username = name", () =>
    supabaseAdmin.from("content_visits").delete({ count: "exact" }).eq("username", username)
  );
  await run("feedback", "username = name", () =>
    supabaseAdmin.from("feedback").delete({ count: "exact" }).eq("username", username)
  );
  await run("reports", "reporter_username = name", () =>
    supabaseAdmin.from("reports").delete({ count: "exact" }).eq("reporter_username", username)
  );
  // 알림은 보낸 사람·받는 사람 두 칸에 이름이 들어간다
  await run("notifications", "target_username = name", () =>
    supabaseAdmin.from("notifications").delete({ count: "exact" }).eq("target_username", username)
  );
  await run("notifications", "actor_username = name", () =>
    supabaseAdmin.from("notifications").delete({ count: "exact" }).eq("actor_username", username)
  );

  // 컬렉션: 목록에 담긴 항목을 먼저 지우고 목록을 지운다
  try {
    const { data: lists } = await supabaseAdmin.from("user_lists").select("id").eq("user_id", userId);
    for (const list of lists || []) {
      await supabaseAdmin.from("list_items").delete().eq("list_id", list.id);
    }
    const { error } = await supabaseAdmin.from("user_lists").delete().eq("user_id", userId);
    steps.push({ table: "user_lists", filter: "user_id", deleted: lists?.length ?? 0, ...(error ? { error: error.message } : {}) });
  } catch (e: any) {
    steps.push({ table: "user_lists", filter: "user_id", deleted: null, error: e?.message || "unknown" });
  }

  return { steps, failures: steps.filter(s => s.error) };
}
