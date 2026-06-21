import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AuditAction = "sanction" | "unsanction" | "hide_content" | "restore_content" | "delete_content";
type TargetType = "user" | "review" | "comment";

interface AuditEntry {
  action: AuditAction;
  target_type: TargetType;
  target_id: string;
  details?: Record<string, any>;
}

/**
 * Log an admin action to the audit trail.
 * Silent — does not throw on failure to avoid breaking main operations.
 */
export async function logAdminAction(
  adminUsername: string,
  action: AuditAction,
  targetType: TargetType,
  targetId: string,
  details?: Record<string, any>
) {
  try {
    const { error } = await supabaseAdmin.from("admin_actions").insert({
      action,
      target_type: targetType,
      target_id: targetId,
      details: details || {},
      admin_username: adminUsername,
    });
    if (error) console.error("[audit-log] Insert failed:", error.message);
  } catch (err: any) {
    console.error("[audit-log] Unexpected error:", err.message);
  }
}
